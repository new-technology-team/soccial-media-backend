const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const dict = {
    "Ä Äƒng nháº­p": "Đăng nhập",
    "ÄÄƒng nháºp": "Đăng nhập",
    "Ä Äƒng": "Đăng",
    "Ä‘Äƒng": "đăng",
    "nháº­p": "nhập",
    "Ä‘á»ƒ": "để",
    "tiáº¿p tá»¥c": "tiếp tục",
    "sá»­ dá»¥ng": "sử dụng",
    "tĂ i khoáº£n": "tài khoản",
    "cá»§a báº¡n": "của bạn",
    "Báº¯t Ä‘áº§u": "Bắt đầu",
    "hĂ nh trĂ¬nh": "hành trình",
    "káº¿t ná»‘i": "kết nối",
    "Nháº­p": "Nhập",
    "mĂ£": "mã",
    "Ä‘Ă£": "đã",
    "gá»­i": "gửi",
    "Ä‘áº¿n": "đến",
    "sá»‘ Ä‘iá»‡n thoáº¡i": "số điện thoại",
    "KhĂ´i phá»¥c": "Khôi phục",
    "bÆ°á»›c": "bước",
    "an toĂ n": "an toàn",
    "Khu vá»±c": "Khu vực",
    "dĂ nh riĂªng": "dành riêng",
    "há»‡ thá»‘ng": "hệ thống",
    "Máº­t kháº©u": "Mật khẩu",
    "QuĂªn": "Quên",
    "máº­t kháº©u": "mật khẩu",
    "Hoáº·c": "Hoặc",
    "báº±ng": "bằng",
    "ChÆ°a": "Chưa",
    "cĂ³": "có",
    "Ä Äƒng kĂ½": "Đăng ký",
    "ngay": "ngay",
    "LĂ ": "Là",
    "quáº£n trá»‹ viĂªn": "quản trị viên",
    "truy cáº­p": "truy cập",
    "tin nháº¯n": "tin nhắn",
    "thĂ´ng bĂ¡o": "thông báo",
    "vĂ ": "và",
    "cĂ¡ nhĂ¢n": "cá nhân",
    "hĂ³a": "hóa",
    "báº£ng tin": "bảng tin",
    "theo": "theo",
    "sá»Ÿ thĂ­ch": "sở thích",
    "PhiĂªn": "Phiên",
    "háº¿t háº¡n": "hết hạn",
    "Vui lĂ²ng": "Vui lòng",
    "láº¡i": "lại",
    "hoáº·c": "hoặc",
    "khĂ´ng": "không",
    "há»£p lá»‡": "hợp lệ",
    "thá»­": "thử",
    "xĂ¡c thá»±c": "xác thực",
    "ChĂ o má»«ng": "Chào mừng",
    "trá»Ÿ": "trở",
    "ThĂ nh viĂªn": "Thành viên",
    "Má»Ÿ": "Mở",
    "Kiá»ƒm tra": "Kiểm tra",
    "lá» i má» i": "lời mời",
    "tham gia": "tham gia",
    "nhĂ³m": "nhóm",
    "Ä Ă£": "Đã",
    "HĂ£y": "Hãy",
    "chá» ": "chờ",
    "Ä‘á»‘i phÆ°Æ¡ng": "đối phương",
    "cháº¥p nháº­n": "chấp nhận",
    "nháº¯n": "nhắn",
    "giá»›i háº¡n": "giới hạn",
    "KhĂ´ng thá»ƒ": "Không thể",
    "há»§y": "hủy",
    "Cuá»™c gá» i": "Cuộc gọi",
    "thoáº¡i": "thoại",
    "NgÆ°á» i nháº­n": "Người nhận",
    "tham": "tham",
    "gia": "gia",
    "Má»™t ngÆ°á» i": "Một người",
    "rá» i": "rời",
    "Má» i ngÆ°á» i": "Mọi người",
    "káº¿t thĂºc": "kết thúc",
    "Ä‘ang": "đang",
    "ngÆ°á» i": "người",
    "Báº¡n bĂ¨": "Bạn bè",
    "ChÆ°a káº¿t báº¡n": "Chưa kết bạn",
    "Giá»›i háº¡n": "Giới hạn",
    "gá» i": "gọi",
    "ThĂªm": "Thêm",
    "vĂ o": "vào",
    "cuá»™c trĂ² chuyá»‡n": "cuộc trò chuyện",
    "Xem chi tiáº¿t": "Xem chi tiết",
    "miá»…n phĂ­": "miễn phí",
    "trÆ°á»›c khi": "trước khi",
    "cáº§n": "cần",
    "Ä ang": "Đang",
    "ghim": "ghim",
    "trong": "trong",
    "nĂ y": "này",
    "Nháº¯n tin": "Nhắn tin",
    "Káº¿t báº¡n": "Kết bạn",
    "Há»§y": "Hủy",
    "Ä á»“ng Ă½": "Đồng ý",
    "xá»­ lĂ½": "xử lý",
    "Cháº¥p nháº­n": "Chấp nhận",
    "Tá»« chá»‘i": "Từ chối",
    "Káº¿t thĂºc": "Kết thúc",
    "cÅ© hÆ¡n": "cũ hơn",
    "hiá»ƒn thá»‹": "hiển thị",
    "má»›i nháº¥t": "mới nhất",
    "Cuá»™n lĂªn": "Cuộn lên",
    "táº£i thĂªm": "tải thêm",
    "lá»‹ch sá»": "lịch sử",
    "NgÆ°á» i dĂ¹ng": "Người dùng",
    "thu há»“i": "thu hồi",
    "chuyá»ƒn tiáº¿p": "chuyển tiếp",
    "Má»Ÿ tá»‡p": "Mở tệp",
    "Ä‘Ă­nh kĂ¨m": "đính kèm",
    "Táº¡o": "Tạo",
    "há»™i thoáº¡i": "hội thoại",
    "ThĂ´ng bĂ¡o": "Thông báo",
    "ThĂ´ng tin": "Thông tin",
    "Táº¥t cáº£": "Tất cả",
    "Chá» n": "Chọn",
    "Nháº¥n Ä‘á»ƒ": "Nhấn để",
    "bĂ¬nh luáº­n": "bình luận",
    "bĂ i viáº¿t": "bài viết",
    "cáº­p nháº­t": "cập nhật",
    "chá»‰nh sá»a": "chỉnh sửa",
    "Quáº£n lĂ½": "Quản lý",
    "XĂ³a": "Xóa",
    "BĂ¡o cĂ¡o": "Báo cáo",
    "Cháº·n": "Chặn",
    "Gá»¡": "Gỡ",
    "LÆ°u": "Lưu",
    "ThĂ´ng tin": "Thông tin",
    "Trang chá»§": "Trang chủ",
    "CĂ i Ä‘áº·t": "Cài đặt",
    "Ä Äƒng xuáº¥t": "Đăng xuất"
};

const charDict = {
    "áº¯": "ắ", "Ä‘": "đ", "Ă¢": "â", "á»‡": "ệ", "Ăª": "ê", "áº£": "ả", "Ă": "í", "áº¥": "ấ",
    "á»‹": "ị", "Ă´": "ô", "áº­": "ậ", "á»›": "ớ", "á»": "ở", "Ăº": "ú", "Ă¹": "ù", "á»¥": "ụ",
    "á»©": "ứ", "á»ừ": "ừ", "á»±": "ự", "Ă½": "ý", "á»·": "ỷ", "á»¹": "ỹ", "á»µ": "ỵ",
    "Ă ": "à", "Ă¡": "á", "Ă£": "ã", "áº¡": "ạ", "Ă¨": "è", "Ă©": "é", "áº»": "ẻ", "áº½": "ẽ",
    "áº¹": "ẹ", "áº§": "ầ", "áº©": "ẩ", "áº«": "ẫ", "Ă¬": "ì", "Ä©": "ĩ", "Ă²": "ò", "Ă³": "ó",
    "á» ": "ỏ", "Ăµ": "õ", "á» ": "ọ", "á»“": "ồ", "á»•": "ổ", "á»—": "ỗ", "á»™": "ộ", "á» ": "ờ",
    "á»¡": "ỡ", "á»£": "ợ", "Äƒ": "ă", "áº±": "ằ", "áº³": "ẳ", "áºµ": "ẵ", "áº·": "ặ",
    "Ä ": "Đ", "Ă‚": "Â", "ĂŠ": "É", "Ă ": "Í", "Ă”": "Ô", "Ăš": "Ú", "Ă ": "Ý",
    "á» ": "ệ", "Ă ": "i", "á» ": "ử" 
};

// Build reverse dictionary, skipping ASCII words and resolving collisions
const reverseCharDict = {};
for (const [bad, good] of Object.entries(charDict)) {
    if (!reverseCharDict[good]) {
        reverseCharDict[good] = bad;
    }
}
const reverseDict = {};
for (const [bad, good] of Object.entries(dict)) {
    if (good !== bad && !reverseDict[good]) {
        reverseDict[good] = bad;
    }
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // STEP 1: Undo fix_encoding3.js damage.
    // fix_encoding3.js replaced "Ă" with "í" before it could replace "Ă " with "i".
    // So all "Ă " (which came from natural "i") became "í ".
    // All "Ă¡" became "í¡".
    // We just replace "í " with "i" (restores natural i)
    // And replace remaining "í" with "Ă" (restores the mojibake character Ă which is 0xC3)
    content = content.replace(/í /g, 'i');
    content = content.replace(/í/g, 'Ă');

    // STEP 2: Now the file is EXACTLY in the state after fix_encoding.js
    // That means `dict` replacements and `charDict` replacements were applied.
    // To undo them, we apply `reverseCharDict` THEN `reverseDict`.
    
    // We must NOT reverse "i" back to "Ă " because we already fixed it!
    for (const [good, bad] of Object.entries(reverseCharDict)) {
        if (good === 'i' || good === 'í') continue; // Skip 'i' because it's already handled. Skip 'í' because there was no natural 'í'.
        if (content.includes(good)) {
            content = content.split(good).join(bad);
        }
    }

    for (const [good, bad] of Object.entries(reverseDict)) {
        if (content.includes(good)) {
            content = content.split(good).join(bad);
        }
    }

    // STEP 3: Now the file is EXACTLY in the ORIGINAL UNCOMMITTED STATE!
    // It contains the original mojibake.
    // Wait, some characters like 'Ă' (C3) might have been missed if I didn't match perfectly.
    // But this state is safe.
    // Now, we fix it perfectly using iconv-lite.
    // The mojibake is valid UTF-8 strings interpreted as CP1258, then saved as UTF-8.
    // So we encode the string to bytes using cp1258, then decode as utf8.
    
    // But we CANNOT apply this globally, because the file contains valid English code (ASCII).
    // And valid Emojis or other Unicode characters > 255.
    // If we encode the whole string to cp1258, characters > 255 (like emojis) will be lost!
    // So we only encode substrings that are actually mojibake.
    // Mojibake substrings are sequences of characters >= 0x80 (plus a few control chars like \x90).

    // Let's create a regex to match mojibake substrings.
    // A CP1258 decoded string will have characters mapped from 0x80-0xFF.
    // All characters from 0x80 to 0xFF in CP1258 map to some Unicode character.
    // Let's list all Unicode characters that CP1258 0x80-0xFF maps to.
    const cp1258_chars = [];
    for (let i = 0x80; i <= 0xFF; i++) {
        let ch = iconv.decode(Buffer.from([i]), 'cp1258');
        if (ch && ch.length === 1) {
            cp1258_chars.push(ch);
        } else if (ch && ch.length > 1) {
            cp1258_chars.push(ch[0]);
            cp1258_chars.push(ch[1]);
        }
    }
    
    // Convert to regex set
    let escaped = cp1258_chars.map(c => c.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('');
    // Also include \x90 (since sometimes it maps to control chars)
    let regex = new RegExp(`[${escaped}\\x80-\\x9F]+`, 'g');

    content = content.replace(regex, (match) => {
        // Double check: if match is just one or two characters, it might be a false positive (like a single bullet point).
        // But let's try to decode it.
        let buf = iconv.encode(match, 'cp1258');
        let decoded = iconv.decode(buf, 'utf8');
        
        // If decoding gives replacement character \uFFFD, it's not a valid UTF-8 sequence, so skip.
        if (decoded.includes('\uFFFD') || decoded === '') {
            return match;
        }
        
        // If decoded is shorter than match by a lot? No, it's fine.
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
