import { useMemo, useState } from "react";
import { Archive, Check, ChevronDown, CirclePlus, Search, SlidersHorizontal, Utensils, X } from "lucide-react";
import { Button, Notice, SelectField, StatusBadge, Surface, TextField } from "../../shared/ui";
import "./catalog.css";

type CatalogOption = { id: string; name: string; price: number };
type CatalogGroup = { id: string; name: string; required: boolean; multiple: boolean; options: CatalogOption[] };
type CatalogProduct = { id: number; name: string; category: string; price: number; sku: string; active: boolean; stockTracked: boolean; groups: CatalogGroup[] };

const seedProducts: CatalogProduct[] = [
  { id: 1, name: "برگر کلاسیک", category: "غذای اصلی", price: 185000, sku: "FD-001", active: true, stockTracked: true, groups: [
    { id: "size", name: "اندازه برگر", required: true, multiple: false, options: [{ id: "regular", name: "معمولی", price: 0 }, { id: "double", name: "دوبل", price: 65000 }] },
    { id: "extra", name: "افزودنی‌ها", required: false, multiple: true, options: [{ id: "cheese", name: "پنیر اضافه", price: 18000 }, { id: "mushroom", name: "قارچ گریل", price: 25000 }] },
  ] },
  { id: 2, name: "پیتزا مخصوص", category: "غذای اصلی", price: 265000, sku: "FD-002", active: true, stockTracked: true, groups: [
    { id: "pizza-size", name: "سایز", required: true, multiple: false, options: [{ id: "one", name: "یک نفره", price: 0 }, { id: "two", name: "دو نفره", price: 95000 }, { id: "family", name: "خانوادگی", price: 185000 }] },
  ] },
  { id: 3, name: "ساندویچ مرغ", category: "غذای اصلی", price: 158000, sku: "FD-003", active: true, stockTracked: true, groups: [] },
  { id: 4, name: "قهوه اسپرسو", category: "قهوه", price: 72000, sku: "CF-001", active: true, stockTracked: false, groups: [] },
  { id: 5, name: "لاته", category: "قهوه", price: 118000, sku: "CF-002", active: false, stockTracked: true, groups: [
    { id: "cup", name: "اندازه لیوان", required: true, multiple: false, options: [{ id: "small", name: "کوچک", price: 0 }, { id: "large", name: "بزرگ", price: 35000 }] },
    { id: "milk", name: "نوع شیر", required: true, multiple: false, options: [{ id: "normal", name: "معمولی", price: 0 }, { id: "oat", name: "جو دوسر", price: 25000 }] },
  ] },
  { id: 6, name: "چیزکیک", category: "دسر", price: 112000, sku: "DS-001", active: true, stockTracked: false, groups: [] },
];
const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export function CatalogWorkspace() {
  const [products, setProducts] = useState(seedProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("همه");
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("غذای اصلی");
  const categories = ["همه", ...Array.from(new Set(products.map((product) => product.category)))];
  const visible = useMemo(() => products.filter((product) =>
    (category === "همه" || product.category === category) &&
    `${product.name} ${product.sku}`.toLocaleLowerCase("fa-IR").includes(query.trim().toLocaleLowerCase("fa-IR"))
  ), [products, category, query]);
  const selected = products.find((product) => product.id === selectedId) ?? null;

  function toggleAvailability(id: number) {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, active: !product.active } : product));
  }
  function addProduct() {
    const name = newName.trim();
    const price = Number(newPrice.replace(/[^0-9]/g, ""));
    if (!name || !Number.isSafeInteger(price) || price <= 0) return;
    const nextId = Math.max(0, ...products.map((product) => product.id)) + 1;
    const product: CatalogProduct = { id: nextId, name, category: newCategory, price, sku: `NEW-${String(nextId).padStart(3, "0")}`, active: true, stockTracked: false, groups: [] };
    setProducts((current) => [product, ...current]);
    setSelectedId(nextId); setShowNew(false); setNewName(""); setNewPrice("");
  }

  return (
    <div className="page-stack catalog-workspace">
      <div className="catalog-heading"><div><span className="ui-eyebrow">PRODUCT CATALOG</span><h1>منو و محصولات</h1><p>مدیریت محصولات، قیمت پایه، وضعیت فروش و گروه‌های گزینه</p></div><Button variant="primary" onClick={() => setShowNew((value) => !value)}><CirclePlus size={15} /> محصول جدید</Button></div>
      <Notice variant="warning">این صفحه نمونه تعاملی است. تغییرات، فعال‌سازی و محصول جدید فقط در حافظه مرورگر باقی می‌مانند و به صندوق یا دیتابیس متصل نیستند.</Notice>
      <div className="catalog-metrics">
        <Surface padding="sm"><span>کل محصولات نمونه</span><strong>{money(products.length)}</strong></Surface>
        <Surface padding="sm"><span>فعال برای فروش</span><strong>{money(products.filter((product) => product.active).length)}</strong></Surface>
        <Surface padding="sm"><span>دارای گروه گزینه</span><strong>{money(products.filter((product) => product.groups.length > 0).length)}</strong></Surface>
      </div>
      {showNew ? <Surface padding="md" className="catalog-create">
        <div className="catalog-create-heading"><strong>افزودن محصول نمونه</strong><button type="button" onClick={() => setShowNew(false)} aria-label="بستن"><X size={16} /></button></div>
        <div className="catalog-create-fields"><TextField label="نام محصول" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="مثلاً سالاد سزار" /><TextField label="قیمت پایه به تومان" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} placeholder="مثلاً ۱۸۵۰۰۰" /><SelectField label="دسته‌بندی" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} options={["غذای اصلی", "نوشیدنی", "قهوه", "دسر"].map((value) => ({ value, label: value }))} /></div>
        <div className="catalog-create-footer"><span>شناسه نمونه پس از افزودن ساخته می‌شود.</span><Button variant="primary" onClick={addProduct} disabled={!newName.trim() || !newPrice.trim()}>افزودن به فهرست</Button></div>
      </Surface> : null}
      <div className="catalog-layout">
        <Surface padding="md" className="catalog-list">
          <div className="catalog-list-heading"><div><h2><Utensils size={17} /> فهرست محصولات</h2><p>{money(visible.length)} محصول</p></div><SlidersHorizontal size={17} /></div>
          <label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام محصول یا کد کالا" /><button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جست‌وجو" disabled={!query}><X size={14} /></button></label>
          <div className="catalog-categories">{categories.map((item) => <button type="button" key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="catalog-product-list">{visible.map((product) => <button type="button" className={selectedId === product.id ? "catalog-product is-selected" : "catalog-product"} key={product.id} onClick={() => setSelectedId(product.id)}>
            <span className="catalog-product-icon"><Utensils size={16} /></span><span className="catalog-product-copy"><strong>{product.name}</strong><small>{product.sku} · {product.category}</small></span><span className="catalog-product-price">{money(product.price)} <small>تومان</small></span><StatusBadge variant={product.active ? "success" : "neutral"}>{product.active ? "فعال" : "غیرفعال"}</StatusBadge>
          </button>)}</div>
          {!visible.length ? <div className="catalog-empty"><Archive size={22} /><strong>محصولی پیدا نشد</strong><span>فیلتر یا عبارت جست‌وجو را تغییر دهید.</span></div> : null}
        </Surface>
        <Surface padding="md" className="catalog-detail">
          {selected ? <>
            <div className="catalog-detail-heading"><div><span className="ui-eyebrow">PRODUCT DETAILS</span><h2>{selected.name}</h2><p>{selected.sku} · {selected.category}</p></div><StatusBadge variant={selected.active ? "success" : "neutral"}>{selected.active ? "فعال برای فروش" : "غیرفعال"}</StatusBadge></div>
            <div className="catalog-base-price"><span>قیمت پایه</span><strong>{money(selected.price)} <small>تومان</small></strong></div>
            <div className="catalog-detail-meta"><div><span>وضعیت ردیابی موجودی</span><strong>{selected.stockTracked ? "ردیابی‌شونده" : "بدون ردیابی مستقیم"}</strong></div><div><span>تعداد گروه گزینه</span><strong>{money(selected.groups.length)}</strong></div></div>
            <div className="catalog-groups-heading"><strong>گروه‌های گزینه و افزودنی</strong><span>{selected.groups.length ? "قابل تنظیم در کاتالوگ" : "بدون گزینه"}</span></div>
            {selected.groups.length ? selected.groups.map((group) => <section className="catalog-option-group" key={group.id}><div><strong>{group.name}</strong><StatusBadge variant={group.required ? "warning" : "neutral"}>{group.required ? "اجباری" : "اختیاری"}</StatusBadge><small>{group.multiple ? "چندانتخابی" : "تک‌انتخابی"}</small></div>{group.options.map((option) => <div className="catalog-option" key={option.id}><span>{option.name}</span><b>{option.price ? `+ ${money(option.price)} تومان` : "بدون هزینه"}</b></div>)}</section>) : <div className="catalog-no-options">برای این محصول گروه گزینه‌ای تعریف نشده است.</div>}
            <div className="catalog-detail-actions"><Button variant={selected.active ? "secondary" : "primary"} onClick={() => toggleAvailability(selected.id)}>{selected.active ? <Archive size={14} /> : <Check size={14} />}{selected.active ? "غیرفعال‌سازی نمونه" : "فعال‌سازی نمونه"}</Button><span>این تغییر فقط نمایشی است.</span></div>
          </> : <div className="catalog-empty"><ChevronDown size={22} /><strong>محصولی انتخاب نشده است</strong><span>از فهرست یک محصول را انتخاب کنید.</span></div>}
        </Surface>
      </div>
    </div>
  );
}
