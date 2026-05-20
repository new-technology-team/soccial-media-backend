const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    const win1252ToByte = {
        0x20AC: 0x80, 0x81: 0x81, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
        0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x8D: 0x8D, 0x017D: 0x8E, 0x8F: 0x8F,
        0x90: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x9D: 0x9D, 0x017E: 0x9E, 0x0178: 0x9F
    };
    for(let i=0xA0; i<=0xFF; i++) win1252ToByte[i] = i;

    let chars = Object.keys(win1252ToByte).map(c => parseInt(c)).map(c => String.fromCharCode(c)).join('');
    chars = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    let regex = new RegExp(`[${chars}]+`, 'g');

    content = content.replace(regex, (match) => {
        let buf = Buffer.alloc(match.length);
        for(let i=0; i<match.length; i++) {
            buf[i] = win1252ToByte[match.charCodeAt(i)];
        }
        let decoded = buf.toString('utf8');
        // IMPORTANT: Check for invalid UTF-8 decoding using replacement character
        if (decoded.includes('\uFFFD')) {
            return match;
        }
        return decoded;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully fixed: ${filePath}`);
    }
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
                walk(fullPath);
            }
        } else {
            if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.md') || fullPath.endsWith('.css') || fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.json')) {
                fixFile(fullPath);
            }
        }
    });
}

const targetDir = path.join(__dirname, 'src');
console.log('Scanning:', targetDir);
walk(targetDir);
