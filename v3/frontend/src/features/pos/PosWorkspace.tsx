import { useMemo, useState } from "react";
import {
  Coffee,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Notice,
  SelectField,
  StatusBadge,
  Surface,
  TextField,
} from "../../shared/ui";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  symbol: string;
  optionGroups?: OptionGroup[];
};

type ProductOption = { id: string; name: string; price: number };
type OptionGroup = { id: string; title: string; required: boolean; multiple: boolean; options: ProductOption[] };
type CartLine = { product: Product; quantity: number; selectedOptions: ProductOption[]; note: string; configurationKey: string };

const categories = ["همه", "غذای اصلی", "نوشیدنی", "قهوه", "دسر"];

const sampleProducts: Product[] = [
  { id: 1, name: "برگر کلاسیک", category: "غذای اصلی", price: 185000, description: "گوشت، پنیر و سبزیجات", symbol: "🍔", optionGroups: [{ id: "size", title: "اندازه برگر", required: true, multiple: false, options: [{ id: "regular", name: "معمولی", price: 0 }, { id: "double", name: "دوبل", price: 65000 }] }, { id: "extras", title: "افزودنی‌ها", required: false, multiple: true, options: [{ id: "cheese", name: "پنیر اضافه", price: 18000 }, { id: "mushroom", name: "قارچ گریل", price: 25000 }, { id: "sauce", name: "سس ویژه", price: 10000 }] }] },
  { id: 2, name: "پیتزا مخصوص", category: "غذای اصلی", price: 265000, description: "پنیر، قارچ و مخلفات", symbol: "🍕", optionGroups: [{ id: "size", title: "سایز پیتزا", required: true, multiple: false, options: [{ id: "small", name: "یک نفره", price: 0 }, { id: "medium", name: "دو نفره", price: 95000 }, { id: "large", name: "خانوادگی", price: 185000 }] }, { id: "extras", title: "افزودنی‌ها", required: false, multiple: true, options: [{ id: "cheese", name: "پنیر اضافه", price: 30000 }, { id: "olive", name: "زیتون", price: 15000 }] }] },
  { id: 3, name: "ساندویچ مرغ", category: "غذای اصلی", price: 158000, description: "مرغ گریل و سس مخصوص", symbol: "🥪" },
  { id: 4, name: "سیب‌زمینی", category: "غذای اصلی", price: 85000, description: "یک پرس متوسط", symbol: "🍟" },
  { id: 5, name: "قهوه اسپرسو", category: "قهوه", price: 72000, description: "یک شات اسپرسو", symbol: "☕" },
  { id: 6, name: "لاته", category: "قهوه", price: 118000, description: "اسپرسو و شیر", symbol: "🥛", optionGroups: [{ id: "size", title: "اندازه لیوان", required: true, multiple: false, options: [{ id: "small", name: "کوچک", price: 0 }, { id: "large", name: "بزرگ", price: 35000 }] }, { id: "milk", title: "نوع شیر", required: true, multiple: false, options: [{ id: "normal", name: "شیر معمولی", price: 0 }, { id: "oat", name: "شیر جو دوسر", price: 25000 }] }] },
  { id: 7, name: "آب پرتقال", category: "نوشیدنی", price: 95000, description: "آب‌میوه طبیعی", symbol: "🍊" },
  { id: 8, name: "نوشابه", category: "نوشیدنی", price: 38000, description: "قوطی ۳۳۰ میلی‌لیتر", symbol: "🥤" },
  { id: 9, name: "چیزکیک", category: "دسر", price: 112000, description: "برش کیک روز", symbol: "🍰" },
  { id: 10, name: "بستنی", category: "دسر", price: 68000, description: "دو اسکوپ", symbol: "🍨" },
];

const normalizeDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const parseAmount = (value: string) => {
  const normalized = normalizeDigits(value).replace(/[،,٬\s]/g, "").replace(/[^0-9]/g, "");
  return normalized ? Number(normalized) : 0;
};

const money = (value: number) =>
  new Intl.NumberFormat("fa-IR").format(value);

const orderTypes = [
  { value: "dine-in", label: "سرو داخل" },
  { value: "takeaway", label: "بیرون‌بر" },
  { value: "delivery", label: "ارسال" },
];

const paymentTypes = [
  { value: "cash", label: "نقدی" },
  { value: "terminal", label: "کارتخوان" },
  { value: "split", label: "ترکیبی" },
];

export function PosWorkspace() {
  const [category, setCategory] = useState("همه");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState("dine-in");
  const [paymentType, setPaymentType] = useState("cash");
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState("0");
  const [showSummary, setShowSummary] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [lineNote, setLineNote] = useState("");

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa-IR");
    return sampleProducts.filter((product) => {
      const inCategory = category === "همه" || product.category === category;
      const matchesQuery = !normalized ||
        `${product.name} ${product.description}`.toLocaleLowerCase("fa-IR").includes(normalized);
      return inCategory && matchesQuery;
    });
  }, [category, query]);

  const lineUnitPrice = (line: CartLine) => line.product.price + line.selectedOptions.reduce((sum, option) => sum + option.price, 0);
  const subtotal = cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  const requestedDiscount = parseAmount(discount);
  const discountAmount = Math.min(subtotal, Math.max(0, Math.floor(requestedDiscount)));
  const total = subtotal - discountAmount;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function openProductEditor(product: Product) {
    if (!product.optionGroups?.length) { addConfiguredProduct(product, [], ""); return; }
    setEditingProduct(product); setSelectedOptions([]); setLineNote("");
  }
  function addConfiguredProduct(product: Product, options: ProductOption[], note: string) {
    const configurationKey = options.map((option) => option.id).sort().join("|") + "::" + note.trim();
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id && line.configurationKey === configurationKey);
      if (existing) return current.map((line) => line.configurationKey === configurationKey && line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { product, quantity: 1, selectedOptions: options, note: note.trim(), configurationKey }];
    });
    setEditingProduct(null); setSelectedOptions([]); setLineNote(""); setShowSummary(false);
  }
  function toggleOption(group: OptionGroup, option: ProductOption) {
    setSelectedOptions((current) => {
      const exists = current.some((item) => item.id === option.id);
      if (group.multiple) return exists ? current.filter((item) => item.id !== option.id) : [...current, option];
      return [...current.filter((item) => !group.options.some((candidate) => candidate.id === item.id)), option];
    });
  }
  function confirmProductOptions() {
    if (!editingProduct) return;
    const missing = (editingProduct.optionGroups || []).some((group) => group.required && !selectedOptions.some((option) => group.options.some((candidate) => candidate.id === option.id)));
    if (!missing) addConfiguredProduct(editingProduct, selectedOptions, lineNote);
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((current) => current
      .map((line) => line.product.id === productId
        ? { ...line, quantity: line.quantity + delta }
        : line)
      .filter((line) => line.quantity > 0));
    setShowSummary(false);
  }

  function clearCart() {
    setCart([]);
    setDiscount("0");
    setShowSummary(false);
  }

  return (
    <div className="page-stack pos-workspace">
      <div className="pos-page-heading">
        <div>
          <span className="ui-eyebrow">POINT OF SALE</span>
          <h1>صندوق فروش</h1>
          <p>ثبت سریع سفارش حضوری و مدیریت سبد خرید</p>
        </div>
        <div className="pos-heading-meta">
          <StatusBadge variant="warning">دموی تعاملی</StatusBadge>
          <span>اطلاعات محصولات نمونه است</span>
        </div>
      </div>

      <Notice variant="warning">
        این صفحه فعلاً محیط طراحی است. افزودن محصول و محاسبات فقط در همین صفحه انجام می‌شود؛
        هیچ سفارش، پرداخت یا تغییری در موجودی ثبت نمی‌شود.
      </Notice>

      <div className="pos-layout">
        <Surface padding="md" className="pos-catalog">
          <div className="pos-catalog-heading">
            <div>
              <h2>انتخاب محصول</h2>
              <p>برای افزودن به سبد، روی محصول بزنید</p>
            </div>
            <span className="pos-count">{money(visibleProducts.length)} محصول</span>
          </div>

          <label className="pos-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی نام محصول..."
              aria-label="جست‌وجوی محصول"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جست‌وجو">
                <X size={15} />
              </button>
            ) : null}
          </label>

          <div className="pos-categories" role="group" aria-label="دسته‌بندی محصولات">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "pos-category is-active" : "pos-category"}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {visibleProducts.length ? (
            <div className="pos-product-grid">
              {visibleProducts.map((product) => (
                <button
                  type="button"
                  className="pos-product-card"
                  key={product.id}
                  onClick={() => openProductEditor(product)}
                  aria-label={`افزودن ${product.name} به سبد خرید`}
                >
                  <span className="pos-product-symbol" aria-hidden="true">{product.symbol}</span>
                  <span className="pos-product-name">{product.name}</span>
                  <span className="pos-product-description">{product.description}</span>
                  <span className="pos-product-footer">
                    <strong>{money(product.price)} <small>تومان</small></strong>
                    <span className="pos-add-icon"><Plus size={15} /></span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="pos-no-products">
              <Search size={22} />
              <strong>محصولی پیدا نشد</strong>
              <span>عبارت جست‌وجو یا دسته‌بندی را تغییر دهید.</span>
            </div>
          )}
          {editingProduct ? (
            <div className="pos-option-editor" role="dialog" aria-label={`شخصی‌سازی ${editingProduct.name}`}>
              <div className="pos-option-editor-heading"><div><strong>شخصی‌سازی {editingProduct.name}</strong><span>گزینه‌های موردنظر را انتخاب کنید</span></div><button type="button" onClick={() => setEditingProduct(null)} aria-label="بستن"><X size={17} /></button></div>
              {(editingProduct.optionGroups || []).map((group) => <fieldset className="pos-option-group" key={group.id}><legend>{group.title} {group.required ? <span>الزامی</span> : <small>اختیاری</small>}</legend><div className="pos-option-list">{group.options.map((option) => { const checked = selectedOptions.some((item) => item.id === option.id); return <label className={checked ? "pos-option is-selected" : "pos-option"} key={option.id}><input type={group.multiple ? "checkbox" : "radio"} name={`option-${group.id}`} checked={checked} onChange={() => toggleOption(group, option)} /><span>{option.name}</span><strong>{option.price ? `+ ${money(option.price)} تومان` : "بدون هزینه"}</strong></label>; })}</div></fieldset>)}
              <TextField label="توضیحات این قلم (اختیاری)" value={lineNote} onChange={(event) => setLineNote(event.target.value)} placeholder="مثلاً بدون پیاز، سس جداگانه..." />
              <div className="pos-option-editor-footer"><span>قیمت پایه + افزودنی‌ها</span><strong>{money(editingProduct.price + selectedOptions.reduce((sum, option) => sum + option.price, 0))} تومان</strong></div>
              <Button variant="primary" onClick={confirmProductOptions} disabled={(editingProduct.optionGroups || []).some((group) => group.required && !selectedOptions.some((option) => group.options.some((candidate) => candidate.id === option.id)))}>افزودن به سبد</Button>
            </div>
          ) : null}
        </Surface>

        <Surface padding="md" className="pos-cart">
          <div className="pos-cart-heading">
            <div>
              <h2><ShoppingBag size={18} /> سبد سفارش</h2>
              <p>{money(itemCount)} قلم</p>
            </div>
            {cart.length ? (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 size={14} /> پاک‌کردن
              </Button>
            ) : null}
          </div>

          {cart.length ? (
            <div className="pos-cart-lines">
              {cart.map((line) => (
                <div className="pos-cart-line" key={line.configurationKey + ":" + line.product.id}>
                  <span className="pos-cart-emoji" aria-hidden="true">{line.product.symbol}</span>
                  <div className="pos-cart-line-copy">
                    <strong>{line.product.name}</strong>
                    <small>{money(lineUnitPrice(line))} تومان</small>{line.selectedOptions.length ? <small>{line.selectedOptions.map((option) => option.name).join("، ")}</small> : null}{line.note ? <small>یادداشت: {line.note}</small> : null}
                  </div>
                  <div className="pos-quantity">
                    <button type="button" onClick={() => changeQuantity(line.product.id, 1)} aria-label={`افزایش ${line.product.name}`}>
                      <Plus size={13} />
                    </button>
                    <span>{money(line.quantity)}</span>
                    <button type="button" onClick={() => changeQuantity(line.product.id, -1)} aria-label={`کاهش ${line.product.name}`}>
                      {line.quantity === 1 ? <Trash2 size={12} /> : <Minus size={13} />}
                    </button>
                  </div>
                  <strong className="pos-line-total">{money(lineUnitPrice(line) * line.quantity)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="pos-cart-empty">
              <span><ShoppingBag size={24} /></span>
              <strong>سبد خرید خالی است</strong>
              <p>از فهرست محصولات، یک مورد انتخاب کنید.</p>
            </div>
          )}

          <div className="pos-cart-options">
            <SelectField
              label="نوع سفارش"
              value={orderType}
              onChange={(event) => setOrderType(event.target.value)}
              options={orderTypes}
              placeholder="نوع سفارش را انتخاب کنید"
            />
            <TextField
              label="نام یا شماره مشتری (اختیاری)"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              placeholder="جست‌وجوی مشتری"
            />
            <SelectField
              label="روش پرداخت (صرفاً انتخاب نمایشی)"
              value={paymentType}
              onChange={(event) => setPaymentType(event.target.value)}
              options={paymentTypes}
              placeholder="روش پرداخت"
            />
            <TextField
              label="تخفیف به تومان"
              inputMode="numeric"
              type="text"
              value={discount}
              onChange={(event) => {
                const amount = parseAmount(event.target.value);
                setDiscount(amount ? String(Math.min(amount, subtotal || amount)) : "");
              }}
              hint="ارقام فارسی و انگلیسی پذیرفته می‌شوند؛ تخفیف از جمع کالاها بیشتر نمی‌شود."
            />
          </div>

          <div className="pos-totals">
            <div><span>جمع کالاها</span><strong>{money(subtotal)} تومان</strong></div>
            <div><span>تخفیف</span><strong className="pos-discount">− {money(discountAmount)} تومان</strong></div>
            <div className="pos-grand-total"><span>مبلغ قابل پرداخت</span><strong>{money(total)} <small>تومان</small></strong></div>
          </div>

          <Button
            variant="primary"
            disabled={!cart.length}
            onClick={() => setShowSummary((value) => !value)}
          >
            {showSummary ? "بستن خلاصه" : "پیش‌نمایش خلاصه سفارش"}
          </Button>
          {showSummary ? (
            <div className="pos-summary" role="status" aria-live="polite">
              <strong>خلاصه نمایشی سفارش</strong>
              <span>نوع سفارش: {orderTypes.find((item) => item.value === orderType)?.label}</span>
              <span>روش پرداخت انتخاب‌شده: {paymentTypes.find((item) => item.value === paymentType)?.label}</span>
              <span>مشتری: {customer.trim() || "مشتری حضوری"}</span>
              <strong>مبلغ: {money(total)} تومان</strong>
            </div>
          ) : null}
          <p className="pos-cart-disclaimer">
            <Coffee size={13} /> پرداخت و ثبت نهایی پس از اتصال Backend فعال می‌شود.
          </p>
        </Surface>
      </div>
    </div>
  );
}
