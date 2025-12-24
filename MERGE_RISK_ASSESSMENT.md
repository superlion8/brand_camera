# Lifestyle 分支合并到 Main 分支风险评估报告

## 📊 变更概览

- **新增文件**: 21 个
- **修改文件**: 15 个
- **新增代码行数**: ~3,538 行
- **提交数量**: 20+ 个提交

## ⚠️ 高风险项

### 1. 数据库表依赖（必须预先创建）

**风险等级**: 🔴 **高**

**依赖的表**:
- `lifestyle_scene_tags` - 场景标签表（用于场景筛选）
- `models_analysis` - 模特分析表（用于模特匹配）

**影响**:
- 如果表不存在，API 会直接失败
- 会导致整个 Lifestyle 功能无法使用

**解决方案**:
```sql
-- 1. 需要创建 lifestyle_scene_tags 表
CREATE TABLE IF NOT EXISTS lifestyle_scene_tags (
  scene_id TEXT PRIMARY KEY,
  outfit_type TEXT NOT NULL,
  upper_category TEXT,
  lower_category TEXT,
  onepiece_category TEXT,
  -- 其他字段...
);

-- 2. models_analysis 表应该已存在（迁移文件 008_models_analysis.sql），但需要确认

-- 3. ⚠️ 重要：更新 generations 表的 type 字段约束
-- 当前约束只允许: ('camera_product', 'camera_model', 'edit', 'studio')
-- 需要添加 'lifestyle' 和其他类型
ALTER TABLE generations 
DROP CONSTRAINT IF EXISTS generations_type_check;

ALTER TABLE generations 
ADD CONSTRAINT generations_type_check 
CHECK (type IN (
  'camera_product', 'camera_model', 'edit', 'studio',
  'lifestyle', 'pro_studio', 'group_shoot', 'social', 'reference_shot'
));
```

**检查命令**:
```sql
-- 检查表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'lifestyle_scene_tags'
);

-- 检查 models_analysis 表
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'models_analysis'
);

-- 检查 generations 表的约束
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%generations%type%';
```

---

### 2. Supabase Storage 存储桶依赖

**风险等级**: 🟡 **中**

**依赖的存储桶路径**:
- `presets/lifestyle_scene/` - 街拍场景图片
- `presets/all_models/` - 所有模特图片（应该已存在）
- `presets/homepage/lifestyle-before.png` - 首页图片
- `presets/homepage/lifestyle-after.jpg` - 首页图片

**影响**:
- 如果存储桶或文件不存在，图片加载会失败
- 首页显示占位图或 404

**解决方案**:
- 确认存储桶已创建并配置了正确的权限
- 确认图片已上传（使用 `scripts/upload-lifestyle-homepage.js`）

---

### 3. API 路由冲突

**风险等级**: 🟢 **低**

**新增路由**:
- `/api/generate-lifestyle` - Lifestyle 生成 API

**检查**:
- ✅ 路由路径唯一，不会与现有路由冲突
- ✅ 使用 SSE (Server-Sent Events) 流式响应

---

### 4. 类型定义变更

**风险等级**: 🟡 **中**

**变更内容**:
- `GenerationType` 新增 `'lifestyle'`
- `TaskType` 新增 `'lifestyle'`
- 新增多个 TypeScript 接口（`ProductTag`, `LifestyleSceneTag`, `ModelAnalysis`, `LifestyleMatchResult`）

**影响**:
- ✅ **代码使用 `task_type` 字段**：`appendImageToGeneration` 函数使用 `task_type` 字段，而不是 `type` 字段
- ✅ **`task_type` 字段无 CHECK 约束**：根据 `001_create_generations_table.sql`，`task_type` 是 `VARCHAR(50)`，没有约束限制
- ⚠️ **注意**：如果数据库实际使用的是 `001_user_data.sql` 中的 `type` 字段（有 CHECK 约束），则需要更新约束

**检查**:
```sql
-- 检查 generations 表的结构
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'generations' 
AND column_name IN ('type', 'task_type');

-- 检查是否有约束
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%generations%type%';
```

**解决方案**:
- ✅ **如果使用 `task_type` 字段**：无需更新约束，直接支持 `'lifestyle'`
- ⚠️ **如果使用 `type` 字段**：需要更新 CHECK 约束（见上面的 SQL）
- 建议：确认生产环境使用的是哪个字段

---

### 5. 首页 UI 顺序变更

**风险等级**: 🟢 **低**

**变更**:
- Lifestyle 卡片从第 3 位移动到第 2 位（在 Pro Studio 之后）

**影响**:
- 用户体验变化（可能需要用户重新适应）
- 不影响功能，只是展示顺序

---

## 🟡 中等风险项

### 6. 翻译文件完整性

**风险等级**: 🟡 **中**

**变更**:
- 新增 `lifestyle` 翻译键到 `zh.ts`, `en.ts`, `ko.ts`

**检查**:
- ✅ 三个语言文件都已更新
- ⚠️ 需要确认所有翻译键都已实现（约 30+ 个新键）

---

### 7. 依赖项检查

**风险等级**: 🟢 **低**

**新增依赖**:
- 无新增 npm 包
- 使用现有依赖：`@supabase/supabase-js`, `framer-motion`, `lucide-react` 等

**Gemini API 模型**:
- `gemini-3-flash-preview` (VLM)
- `gemini-3-pro-image-preview` (图像生成)
- `gemini-2.5-flash-image` (降级方案)

**影响**:
- 需要确认这些模型在 Gemini API 中可用
- 如果模型不可用，会使用降级方案

---

### 8. 存储桶权限

**风险等级**: 🟡 **中**

**需要确认**:
- `presets` 存储桶的公共读取权限
- `lifestyle_scene` 文件夹的访问权限

**检查**:
```sql
-- 在 Supabase Dashboard > Storage > Policies 中检查
```

---

## 🟢 低风险项

### 9. 代码质量

**检查项**:
- ✅ TypeScript 类型定义完整
- ✅ 错误处理完善
- ✅ 代码注释充分
- ✅ 遵循现有代码风格

---

### 10. 性能影响

**潜在影响**:
- API 响应时间：Lifestyle 生成需要 5 步（分析 → 筛选 → 匹配 → 获取素材 → 生成）
- 最大执行时间：300 秒（已配置 `maxDuration = 300`）
- 并发限制：依赖 Gemini API 的并发限制

**优化建议**:
- 监控 API 响应时间
- 考虑添加缓存机制（场景筛选结果）

---

## 📋 合并前检查清单

### 数据库
- [ ] 确认 `lifestyle_scene_tags` 表已创建并包含数据
- [ ] 确认 `models_analysis` 表存在且包含数据
- [ ] 确认 `generations` 表支持 `type = 'lifestyle'`
- [ ] 检查数据库迁移脚本（如果有）

### 存储
- [ ] 确认 `presets/lifestyle_scene/` 文件夹存在且包含图片
- [ ] 确认 `presets/all_models/` 文件夹存在
- [ ] 确认 `presets/homepage/lifestyle-*.png/jpg` 已上传
- [ ] 检查存储桶公共读取权限

### 代码
- [ ] 运行 TypeScript 类型检查：`npm run type-check`
- [ ] 运行 ESLint：`npm run lint`
- [ ] 确认无合并冲突
- [ ] 检查环境变量配置

### 测试
- [ ] 测试 Lifestyle 页面加载
- [ ] 测试商品上传和分析
- [ ] 测试生成流程（完整流程）
- [ ] 测试 Outfit 模式
- [ ] 测试自定义模特/场景选择
- [ ] 测试首页显示

---

## 🚀 合并步骤建议

### 1. 预合并准备
```bash
# 1. 确保数据库表已创建
# 2. 确保存储桶和图片已上传
# 3. 在测试环境验证功能
```

### 2. 合并操作
```bash
# 切换到 main 分支
git checkout main
git pull origin main

# 合并 lifestyle 分支
git merge feature/lifestyle-mode

# 解决可能的冲突（如果有）
# 提交合并
git push origin main
```

### 3. 合并后验证
```bash
# 1. 部署到生产环境
# 2. 验证首页显示
# 3. 测试 Lifestyle 功能
# 4. 监控错误日志
```

---

## 📝 回滚方案

如果合并后出现问题，可以快速回滚：

```bash
# 回滚到合并前的 commit
git revert -m 1 <merge-commit-hash>

# 或者重置到合并前
git reset --hard <pre-merge-commit-hash>
```

**注意**: 回滚后需要：
- 清理数据库中的 `lifestyle` 类型记录（可选）
- 移除新增的路由和页面（代码会自动移除）

---

## ✅ 总结

**总体风险等级**: 🟡 **中等**

**主要风险点**:
1. 数据库表依赖（必须预先创建）
2. 存储桶和图片资源（需要确认存在）
3. 类型定义兼容性（需要检查数据库约束）

**建议**:
- ✅ 在合并前创建数据库表并填充数据
- ✅ 确认所有存储资源已上传
- ✅ 在测试环境完整验证功能
- ✅ 准备回滚方案

**预计影响范围**:
- 新增功能，不影响现有功能
- 如果数据库表不存在，Lifestyle 功能无法使用，但不影响其他功能

