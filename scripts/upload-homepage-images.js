const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'presets';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function uploadFile(localPath, storagePath) {
  const fileContent = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
  
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, fileContent, {
    contentType,
    upsert: true,
  });
  
  if (error) {
    console.error(`❌ 上传失败 ${storagePath}:`, error.message);
    return false;
  }
  console.log(`✓ ${storagePath}`);
  return true;
}

async function uploadHomepageImages() {
  console.log('🚀 上传首页图片到 Supabase Storage');
  console.log(`   Bucket: ${BUCKET_NAME}/homepage`);
  
  const BASE_DIR = '/Users/a/Desktop/bcam_src/首页';
  
  // 专业棚拍
  console.log('\n📸 上传专业棚拍图片...');
  await uploadFile(
    path.join(BASE_DIR, '专业棚拍/before.jpg'),
    'homepage/pro-studio-before.jpg'
  );
  await uploadFile(
    path.join(BASE_DIR, '专业棚拍/after.png'),
    'homepage/pro-studio-after.png'
  );
  
  // 组图拍摄
  console.log('\n📸 上传组图拍摄图片...');
  await uploadFile(
    path.join(BASE_DIR, '组图拍摄/before.png'),
    'homepage/group-shoot-before.png'
  );
  await uploadFile(
    path.join(BASE_DIR, '组图拍摄/after.png'),
    'homepage/group-shoot-after.png'
  );
  
  console.log('\n✅ 上传完成!');
  console.log('\n📝 请更新 page.tsx 中的图片引用:');
  console.log('   专业棚拍: pro-studio-before.jpg, pro-studio-after.png');
  console.log('   组图拍摄: group-shoot-before.png, group-shoot-after.png');
}

uploadHomepageImages().catch(console.error);

