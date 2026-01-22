const fs = require('fs');
const path = require('path');

// 递归复制目录
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 清理并创建 public 目录
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true });
}
fs.mkdirSync(publicDir);

// 复制 src/frontend 到 public
copyDir(path.join(__dirname, '..', 'src', 'frontend'), publicDir);

// 复制 vendor 到 public/vendor
copyDir(path.join(__dirname, '..', 'vendor'), path.join(publicDir, 'vendor'));

// 修复 index.html 中的 vendor 路径
const indexPath = path.join(publicDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/src="\/vendor\//g, 'src="vendor/');
fs.writeFileSync(indexPath, html);

console.log('✅ Build complete! Files copied to public/');
