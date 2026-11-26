import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute, relative));
    else if (entry.isFile()) files.push({ absolute, relative });
  }
  return files;
}

function writeZip(sourceDirectory, destination) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const files = collectFiles(sourceDirectory).sort((a, b) => a.relative.localeCompare(b.relative));

  for (const file of files) {
    const name = Buffer.from(file.relative.split(String.fromCharCode(92)).join("/"), "utf8");
    const raw = readFileSync(file.absolute);
    const compressed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const stamp = dosDateTime(statSync(file.absolute).mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  writeFileSync(destination, Buffer.concat([...localParts, centralDirectory, end]));
  return files.length;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtPublic = resolve(root, "dist");
const packageRoot = resolve(root, "dist-cpanel");
const publicRoot = resolve(packageRoot, "public");
const privateRoot = resolve(packageRoot, "private");
const databaseRoot = resolve(packageRoot, "database");

const requiredBuildFiles = ["index.html", "assets"];
for (const name of requiredBuildFiles) {
  if (!existsSync(resolve(builtPublic, name))) {
    throw new Error(`Missing static build output: dist/${name}. Run npm run build:cpanel first.`);
  }
}

if (existsSync(resolve(privateRoot, "config.php"))) {
  throw new Error("Refusing to overwrite dist-cpanel/private/config.php; move the private config out before packaging.");
}

rmSync(packageRoot, { recursive: true, force: true });
mkdirSync(publicRoot, { recursive: true });
mkdirSync(privateRoot, { recursive: true });
mkdirSync(databaseRoot, { recursive: true });

cpSync(builtPublic, publicRoot, { recursive: true });
cpSync(resolve(root, "php-backend/public/.htaccess"), resolve(publicRoot, ".htaccess"));
mkdirSync(resolve(publicRoot, "uploads"), { recursive: true });
cpSync(resolve(root, "php-backend/public/uploads/.htaccess"), resolve(publicRoot, "uploads/.htaccess"));
cpSync(resolve(root, "php-backend/public/api"), resolve(publicRoot, "api"), { recursive: true });
cpSync(resolve(root, "php-backend/private/.htaccess"), resolve(privateRoot, ".htaccess"));
cpSync(
  resolve(root, "php-backend/private/api-bootstrap.php"),
  resolve(privateRoot, "api-bootstrap.php"),
);
cpSync(
  resolve(root, "php-backend/private/routes"),
  resolve(privateRoot, "routes"),
  { recursive: true },
);
for (const helper of ["birthday-sms.php", "birthday-sms-inbox.php"]) {
  cpSync(
    resolve(root, "php-backend/private", helper),
    resolve(privateRoot, helper),
  );
}
cpSync(
  resolve(root, "php-backend/private/config.example.php"),
  resolve(privateRoot, "config.example.php"),
);
cpSync(resolve(root, "php-backend/schema.sql"), resolve(databaseRoot, "schema.sql"));
cpSync(resolve(root, "php-backend/migrations"), resolve(databaseRoot, "migrations"), {
  recursive: true,
});
cpSync(resolve(root, "php-backend/README-FA.md"), resolve(packageRoot, "README-FA.md"));

const guide = [
  "# بسته استقرار 3Food POS روی cPanel",
  "",
  "## ساختار بسته",
  "",
  "- `public/`: فایل‌های React استاتیک، `.htaccess` و PHP API",
  "- `private/`: بیرون Document Root؛ شامل نمونه تنظیمات خصوصی",
  "- `database/`: schema و migrationهای MySQL",
  "",
  "## به‌روزرسانی نصب موجود",
  "",
  "1. پیش از هر تغییر، از MySQL و فایل خصوصی `private/config.php` نسخه پشتیبان بگیرید؛ پشتیبان JSON داخل برنامه نیز برای بازیابی داده‌ها مفید است.",
  "2. ZIP را در پوشه‌ای جدا از نسخه فعلی استخراج کنید؛ نسخه فعلی را تا پایان بررسی حذف نکنید.",
  "3. فایل `private/config.php` فعلی را به پوشه `private/` نسخه جدید منتقل کنید. فایل `config.example.php` فقط نمونه است و جایگزین تنظیمات واقعی نیست.",
  "4. فایل‌های موجود `public/uploads/` و شش فونت WOFF در `public/fonts/` را به نسخه جدید منتقل کنید؛ این فایل‌ها عمداً در ZIP نیستند تا اطلاعات و دارایی‌های هاست بازنویسی نشوند.",
  "5. فقط migrationهایی را اجرا کنید که قبلاً روی دیتابیس اجرا نشده‌اند. روی دیتابیس دارای اطلاعات، `database/schema.sql` را دوباره import نکنید.",
  "6. پس از تنظیم Document Root روی پوشه `public/` نسخه جدید، مسیرهای `/api/v1/health` و `/api/v1/preflight` را بررسی و ورود، ثبت سفارش، چاپ و دسترسی نقش‌ها را در staging آزمایش کنید.",
  "7. نسخه قبلی را تا اطمینان از کارکرد نسخه جدید و قابل بازیابی بودن backup نگه دارید.",
  "",
  "## نصب",
  "",
  "1. در cPanel یک دیتابیس MySQL و کاربر اختصاصی بسازید.",
  "2. `database/schema.sql` را در دیتابیس خالی وارد کنید. برای دیتابیس موجود، migrationها را به‌ترتیب شماره و فقط یک‌بار اجرا کنید.",
  "3. پوشه `public` را Document Root زیردامنه قرار دهید؛ `private` باید sibling آن و خارج از Document Root بماند.",
  "   فونت‌های IRANYekanWeb FarsiNum که قبلاً در `public_html/fonts/` قرار داده‌اید داخل ZIP نیستند؛ اگر Document Root را به پوشه `public` جدید تغییر می‌دهید، پوشه `fonts` موجود را با همان شش فایل WOFF به `public/fonts/` کپی کنید. هنگام آپدیت، پوشه فونت قبلی را حذف نکنید.",
  "4. `private/config.example.php` را به `private/config.php` کپی کنید و اطلاعات DB، `app_key` و `setup_token` تصادفی را در آن وارد کنید. از commit یا قرار دادن این فایل در پوشه public خودداری کنید.",
  "5. SSL را فعال کنید و سپس `/api/v1/health` و `/api/v1/preflight` را بررسی کنید؛ مقدار `production_ready` باید true باشد.",
  "6. از صفحه ورود، مدیر اولیه را با setup token بسازید؛ سپس setup token را از config خصوصی حذف کنید.",
  "7. تست سفارش و نقش‌ها را روی staging انجام دهید. پیامک فقط پس از واردکردن credential در config خصوصی و آزمایش واقعی فعال شود.",
  "",
  "این بسته هیچ `config.php` واقعی یا رمز دیتابیس ندارد. preflight فقط پیش‌نیازهای فنی را می‌سنجد و build موفق به معنی تأیید سفارش واقعی، نقش‌ها، پیامک یا پذیرش نهایی فروشگاه نیست.",
].join(String.fromCharCode(10));

writeFileSync(resolve(packageRoot, "DEPLOYMENT-FA.md"), guide, "utf8");

const manifest = {
  staticEntry: "public/index.html",
  apiEntry: "public/api/index.php",
  privateConfigTemplate: "private/config.example.php",
  privateApiBootstrap: "private/api-bootstrap.php",
  privateApiRoutes: "private/routes/",
  schema: "database/schema.sql",
};
writeFileSync(resolve(packageRoot, "package-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const packagedFiles = [
  "public/index.html",
  "public/.htaccess",
  "public/api/index.php",
  "public/uploads/.htaccess",
  "private/.htaccess",
  "private/api-bootstrap.php",
  "private/routes/appearance.php",
  "private/routes/auth-users.php",
  "private/routes/inventory-backup.php",
  "private/routes/orders-create.php",
  "private/routes/orders-edit.php",
  "private/routes/orders-status.php",
  "private/routes/orders.php",
  "private/routes/records-bootstrap.php",
  "private/routes/reports-sms.php",
  "private/routes/terminals.php",
  "private/config.example.php",
  "private/birthday-sms.php",
  "private/birthday-sms-inbox.php",
  "database/schema.sql",
  "database/migrations/README-FA.md",
  "database/migrations/002-session-version.sql",
  "database/migrations/003-order-idempotency.sql",
  "database/migrations/004-order-effects-ledger.sql",
  "database/migrations/005-order-discount-code.sql",
  "database/migrations/006-discount-redemptions-ledger.sql",
  "database/migrations/007-order-payment-and-guest-details.sql",
  "database/migrations/008-global-appearance-settings.sql",
  "database/migrations/009-payment-terminal-foundation.sql",
  "DEPLOYMENT-FA.md",
];
for (const relativePath of packagedFiles) {
  if (!existsSync(resolve(packageRoot, relativePath))) {
    throw new Error(`Incomplete cPanel package; missing ${relativePath}`);
  }
}
if (existsSync(resolve(privateRoot, "config.php"))) {
  throw new Error("A real private config must never be included in the generated package.");
}
// Never overwrite the historical archive or a previously generated update.
const archivePath = resolve(root, "3food-pos-v2-update.zip");
if (existsSync(archivePath)) {
  throw new Error("Refusing to overwrite existing 3food-pos-v2-update.zip; move it aside or choose a new output name.");
}
const archiveEntries = writeZip(packageRoot, archivePath);
if (!existsSync(archivePath) || statSync(archivePath).size < 1024 || archiveEntries < 10) {
  throw new Error("cPanel ZIP archive was not created correctly.");
}
console.log("cPanel package created and validated at dist-cpanel/ and 3food-pos-v2-update.zip (" + archiveEntries + " files).");
