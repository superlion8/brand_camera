/**
 * LifeStyle 模式相关 Prompt
 * 用于买家秀 LifeStyle 功能的 AI 提示词
 */

// ============================================
// VLM Prompt - 服装风格分析
// 模型: gemini-3-flash-preview
// 输入: 商品图
// 输出: JSON 格式的服装属性标签
// ============================================
export const LIFESTYLE_VLM_PROMPT = `Role
你是一名资深时尚设计分析师，拥有敏锐的服装结构识别能力。

Task
分析输入图片中的人物服装，并按照严格定义的 Taxonomy（分类法）提取服装属性，输出标准 JSON 数据。

Critical Rules (必须严格遵守)
1. 主导层级原则：只标注最主导、最外层、最可见的服装。
  - 忽略：内搭、鞋子、包袋、首饰、帽子、围巾。
  - 示例：如果穿着 T恤 + 夹克，upper 只能标记 jacket，完全忽略 T恤。
2. 结构互斥原则：
  - 必须先判断 outfit_type。
  - 若为 two_piece：必须填充 upper 和 lower 对象，onepiece 必须为 null。
  - 若为 one_piece：必须填充 onepiece 对象，upper 和 lower 必须为 null。
3. 严格枚举：所有字段值必须严格来自下方的【Vocabulary List】，严禁自造词。
4. 诚实原则：如果因遮挡或图像模糊无法判断某字段，必须填 "unknown"，禁止猜测。
  
Vocabulary List (枚举词表)
1. Global Attributes
- outfit_type: ["two_piece", "one_piece"]
注：one_piece 指连衣裙、连体裤；其他均为 two_piece（上装+下装）。
  
2. Upper Body Attributes (用于 upper 对象)
- category: ["tshirt", "tank_cami", "shirt", "blouse", "polo", "knit_sweater", "cardigan", "hoodie_sweatshirt", "jacket", "blazer", "coat", "puffer", "vest", "unknown"]
- upper_length: ["cropped", "regular", "longline", "unknown"]
- hem: ["straight", "curved", "ribbed", "cinched", "unknown"]
  
3. Lower Body Attributes (用于 lower 对象)
- category: ["jeans", "trousers", "leggings", "shorts", "skirt", "unknown"]
- lower_length: ["mini", "midi", "maxi", "ankle", "full", "unknown"]
- waist_rise: ["low", "mid", "high", "unknown"]
- waistband: ["belt_loops", "elastic", "drawstring", "clean_waist", "unknown"]
- leg_or_skirt_shape: 
  - Pants/Jeans: ["skinny", "straight", "wide", "tapered", "flare"]
  - Skirts: ["a_line", "pencil", "pleated", "wrap", "straight"]
  - Shorts: ["straight", "wide"]
  - Fallback: ["unknown"]
- front_detail: ["flat_front", "pleated", "darted", "unknown"]
- pocket_style: ["5_pocket", "slant", "cargo", "none", "unknown"]
- hem_finish: ["clean", "cuffed", "raw", "slit", "unknown"]
  
4. One-Piece Attributes (用于 onepiece 对象)
- category: ["dress", "jumpsuit_romper", "unknown"]
- onepiece_length: ["mini", "midi", "maxi", "unknown"]
  
5. Shared Design Attributes (通用字段)
- design_intent: ["minimal_clean", "tailored_sharp", "utility_functional", "soft_draped", "statement_bold", "sporty_tech", "unknown"]
- fit: ["slim", "regular", "relaxed", "oversized", "unknown"]
- neck_collar: ["crew", "v_neck", "scoop", "square", "turtleneck", "mockneck", "shirt_collar", "lapel", "hood", "polo_collar", "cami_straps", "unknown"]
- sleeve: ["sleeveless", "short", "long", "three_quarter", "unknown"]
- sleeve_cut: ["regular", "drop_shoulder", "raglan", "puff", "unknown"]
- front (开合方式): ["pullover", "button", "zip", "open_front", "double_breasted", "unknown"]
- material_family: ["cotton", "denim", "wool", "knit", "leather", "nylon", "linen", "silk_satin", "poly_blend", "unknown"]
- texture: ["smooth", "ribbed", "brushed", "fuzzy", "tweed", "corduroy", "coated", "shiny", "unknown"]
- finish: ["clean", "washed", "vintage_fade", "distressed", "coated", "glossy", "matte", "wrinkled", "unknown"]
- pattern: ["solid", "stripe", "check_plaid", "logo_text", "graphic", "jacquard_other", "unknown"]
- color_family: ["black", "white", "gray", "beige", "brown", "navy", "blue", "green", "red", "pink", "yellow", "purple", "orange", "multicolor", "unknown"]
- color_depth: ["light", "mid", "dark", "unknown"]
- color_temp: ["warm", "cool", "neutral", "unknown"]
- occlusion: ["none", "partial", "heavy"]
- signature_details (多选，最多3个，按重要性排序):
["wrap", "asymmetry", "cutout", "peplum", "ruffle", "ruching", "slit", "cargo_pockets", "utility_straps", "contrast_stitch", "raw_edge", "ripped", "shoulder_pad", "sharp_lapel", "stripe_tape", "sporty_panel", "embroidery", "metal_hardware", "fringe"]
  
Output Format
严格输出纯 JSON 格式，不要包含 markdown 标记（如 \`\`\`json），不要包含任何解释性文字。
JSON Schema Template:
{
  "product_id": "",
  "outfit_type": "必须是 'two_piece' 或 'one_piece'",
  "upper": {
    "category": "String",
    "design_intent": "String",
    "fit": "String",
    "upper_length": "String",
    "neck_collar": "String",
    "sleeve": "String",
    "sleeve_cut": "String",
    "front": "String",
    "hem": "String",
    "material_family": "String",
    "texture": "String",
    "finish": "String",
    "pattern": "String",
    "color_family": "String",
    "color_depth": "String",
    "color_temp": "String",
    "signature_details": ["String", "String (optional)", "String (optional)"],
    "occlusion": "String"
  },
  "lower": {
    "category": "String",
    "design_intent": "String",
    "fit": "String",
    "lower_length": "String",
    "waist_rise": "String",
    "leg_or_skirt_shape": "String",
    "waistband": "String",
    "front_detail": "String",
    "pocket_style": "String",
    "hem_finish": "String",
    "material_family": "String",
    "texture": "String",
    "finish": "String",
    "pattern": "String",
    "color_family": "String",
    "color_depth": "String",
    "color_temp": "String",
    "signature_details": ["String", "String (optional)", "String (optional)"],
    "occlusion": "String"
  },
  "onepiece": {
    "category": "String",
    "design_intent": "String",
    "fit": "String",
    "onepiece_length": "String",
    "neck_collar": "String",
    "sleeve": "String",
    "sleeve_cut": "String",
    "front": "String",
    "material_family": "String",
    "texture": "String",
    "finish": "String",
    "pattern": "String",
    "color_family": "String",
    "color_depth": "String",
    "color_temp": "String",
    "signature_details": ["String", "String (optional)", "String (optional)"],
    "occlusion": "String"
  }
}`

// ============================================
// Match Prompt - 模特和场景匹配
// 模型: gemini-3-flash-preview
// 输入: 商品图、product_tag、筛选后的 scene_tags、models_analysis
// 输出: 4个 model_id 和 4个 scene_id
// ============================================
export const buildLifestyleMatchPrompt = (
  productTag: string,
  sceneTags: string,
  modelsAnalysis: string
) => `你是一个"电商服装商品的模特与场景选择器"。

1. 读取[product_tag]（重点关注：类目 category、颜色体系 color_*、结构字段（领型/开合/裤型等）、design_intent、fit）。 

[product_tag]:
${productTag}

2. 在 models_analysis表中选择出4个 model_id，按优先级：
  1. 气质匹配：模特整体气质/风格倾向与商品 design_intent 相符或互补但不冲突
  2. 身材/比例适配：模特身形与商品版型更合适（oversized 更适合骨架感/衣架感；修身更适合线条利落；高腰阔腿更适合比例好）
  3. 商业展示友好：优先能把商品穿得高级、不抢戏、不违和的模特

[models_analysis]:
${modelsAnalysis}

3. 读取lifestyle_scene_tags 中所有场景的标签，进行商品和场景的相似度打分，选出4个 scene_id
对每个参与匹配的槽位（upper/lower/onepiece）计算 slot_score，比较字段并加权：
- Surface（权重 0.40）：material_family, texture, finish, pattern 
- Color（权重 0.35）：color_family, color_depth, color_temp
- Construction（权重 0.20）：
  - upper/onepiece：neck_collar, sleeve, sleeve_cut, front, hem, upper_length/onepiece_length
  - lower：waist_rise, leg_or_skirt_shape, waistband, front_detail, pocket_style, hem_finish, lower_length
- Signature（权重 0.05）：signature_details（按交集数量加分）
unknown/null 处理：任一字段只要一方为 unknown 或缺失 → 跳过该字段（不加分不扣分）  
强冲突惩罚：material_family 或 color_family 明显不一致 → 对该槽位扣分（未知不扣分）

组合总分：
- two_piece 且 upper+lower 都参与：total_score = (upper_score + lower_score) / 2
- 只参与一个槽位：total_score = slot_score

[lifestyle_scene_tags]:
${sceneTags}

输出格式（严格输出纯 JSON，不要包含 markdown 标记或解释文字）：
{
  "model_id_1": "第一个model_id",
  "model_id_2": "第二个model_id",
  "model_id_3": "第三个model_id",
  "model_id_4": "第四个model_id",
  "scene_id_1": "第一个scene_id",
  "scene_id_2": "第二个scene_id",
  "scene_id_3": "第三个scene_id",
  "scene_id_4": "第四个scene_id"
}`

// ============================================
// Final Prompt - 图像生成
// 模型: gemini-3-pro-image-preview
// 输入: 商品图、模特图、场景图
// 输出: 生成的时尚街拍图片
// ============================================
export const LIFESTYLE_FINAL_PROMPT = `[角色：专业时尚街拍摄影师]

任务与参考输入：
基于 [参考场景图] 的视觉风格、氛围和情绪基调，生成一张高质量的时尚街拍大片，用于展示 [商品图]。

[参考场景图] 作为风格与氛围参考。
请学习其整体情绪、色彩体系、光线特征、空间感受以及人物的表现语言。

使用 [模特图] 作为模特参考，切记[参考场景图]中的人物不要出现在最后的图像中，只使用 [模特图] 中的人物。

必须严格保持 [模特图] 模特的身份特征、面部五官和身体比例不变。
模特的姿态、肢体语言和面部表情应受到 [参考场景图] 中角色表现的启发，
采用相似的情绪态度，以及一种观察式、编辑感的表现方式。

镜头视角与镜头焦段也应参考 [参考场景图] 中人物的取景方式，
包括拍摄距离、透视关系，以及空间压缩或延展的感觉，
使生成的图像在摄影观看距离和视觉语言上与参考一致，
而不仅仅是构图或画幅比例上的相似。

你可以遵循真实摄影逻辑，对环境与构图进行适度再设计，
在背景细节、镜头角度、画面取景和空间布局上引入自然变化，
同时保持与参考场景一致的审美方向、气质特征和整体氛围一致性。

技术约束：
1. 商品 [商品图] 必须被模特自然地穿着展示。
2. 面料物理表现必须真实，包括褶皱、垂坠感和重力效果。
3. 环境光线应真实地作用于商品材质。
4. 优先采用抓拍感、非摆拍的表情与自然动作。
5. 避免正面、居中或过于刻意摆拍的构图。
6. 高分辨率，8K，写实风格，商业级时尚摄影。
7. 仅输出最终图像，不要附加任何文字说明。
8. 画幅比例：9:16，竖版（纵向）。`

