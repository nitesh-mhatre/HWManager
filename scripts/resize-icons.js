const sharp = require('sharp');
const path = require('path');

const SOURCE = '/storage/emulated/0/Download/76da05d2-7dc8-4b84-be3b-55f99c38b97b.png';
const ASSETS = path.join(__dirname, '..', 'assets');

async function resizeIcons() {
  console.log('Reading source image...');
  const metadata = await sharp(SOURCE).metadata();
  console.log(`Source: ${metadata.width}x${metadata.height}, ${metadata.format}`);

  // 1. icon.png — 1024x1024 (iOS icon)
  console.log('Creating icon.png (1024x1024)...');
  await sharp(SOURCE)
    .resize(1024, 1024, { fit: 'contain', background: '#1a1a2e' })
    .png()
    .toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png created');

  // 2. adaptive-icon.png — 1024x1024 with padding for Android mask
  console.log('Creating adaptive-icon.png (1024x1024 with padding)...');
  const iconSize = 660; // ~65% of 1024, giving room for Android adaptive mask
  const padding = Math.round((1024 - iconSize) / 2);
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 26, g: 26, b: 46, alpha: 1 } // #1a1a2e
    }
  })
    .composite([{
      input: await sharp(SOURCE)
        .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer(),
      left: padding,
      top: padding
    }])
    .png()
    .toFile(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png created');

  // 3. favicon.png — 48x48 (web)
  console.log('Creating favicon.png (48x48)...');
  await sharp(SOURCE)
    .resize(48, 48, { fit: 'contain', background: '#1a1a2e' })
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png created');

  // 4. splash-icon.png — 200x200 (splash screen)
  console.log('Creating splash-icon.png (200x200)...');
  await sharp(SOURCE)
    .resize(200, 200, { fit: 'contain', background: '#1a1a2e' })
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png created');

  console.log('\n🎉 All icons created successfully!');
}

resizeIcons().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
