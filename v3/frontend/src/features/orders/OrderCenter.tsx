import { useMemo, useState } from "react";
import { Eye, FilterX, PackageCheck } from "lucide-react";
import {
  Button,
  DataTable,
  Notice,
  SelectField,
  StatusBadge,
  Surface,
  TextField,
} from "../../shared/ui";

type DemoOrder = {
  id: string;
  customer: string;
  channel: string;
  orderType: string;
  amount: number;
  status: "new" | "preparing" | "ready" | "delivered" | "cancelled";
  payment: "paid" | "pending" | "partial" | "refunded";
  time: string;
  items: { name: string; quantity: number; options?: string[]; note?: string; unitPrice: number }[];
  timeline: { title: string; detail: string; time: string; state: "done" | "current" | "pending" }[];
};

const demoOrders: DemoOrder[] = [
  { id: "D-1048", customer: "مشتری حضوری", channel: "صندوق", orderType: "سرو داخل", amount: 438000, status: "preparing", payment: "paid", time: "۱۴:۳۲", items: [{ name: "برگر کلاسیک", quantity: 1, options: ["دوبل", "پنیر اضافه"], note: "سس جداگانه", unitPrice: 268000 }, { name: "قهوه اسپرسو", quantity: 1, unitPrice: 72000 }, { name: "سیب‌زمینی", quantity: 1, unitPrice: 98000 }], timeline: [{ title: "ثبت سفارش", detail: "ثبت‌شده از صندوق", time: "۱۴:۳۲", state: "done" }, { title: "تأیید سفارش", detail: "تأیید توسط صندوق‌دار", time: "۱۴:۳۳", state: "done" }, { title: "آماده‌سازی", detail: "در حال آماده‌سازی در آشپزخانه", time: "۱۴:۳۵", state: "current" }, { title: "تحویل", detail: "در انتظار تحویل", time: "—", state: "pending" }] },
  { id: "D-1047", customer: "سارا محمدی", channel: "تلفنی", orderType: "بیرون‌بر", amount: 530000, status: "new", payment: "pending", time: "۱۴:۲۶", items: [{ name: "پیتزا مخصوص", quantity: 2, options: ["دو نفره"], unitPrice: 265000 }], timeline: [{ title: "ثبت سفارش", detail: "ثبت تلفنی توسط اپراتور", time: "۱۴:۲۶", state: "done" }, { title: "تأیید سفارش", detail: "در انتظار بررسی", time: "—", state: "current" }, { title: "آماده‌سازی", detail: "هنوز آغاز نشده", time: "—", state: "pending" }, { title: "تحویل", detail: "در انتظار تحویل", time: "—", state: "pending" }] },
  { id: "D-1046", customer: "علی رضایی", channel: "صندوق", orderType: "ارسال", amount: 226000, status: "ready", payment: "partial", time: "۱۴:۱۸", items: [{ name: "ساندویچ مرغ", quantity: 1, unitPrice: 158000 }, { name: "نوشابه", quantity: 1, unitPrice: 38000 }, { name: "هزینه ارسال", quantity: 1, unitPrice: 30000 }], timeline: [{ title: "ثبت سفارش", detail: "ثبت‌شده از صندوق", time: "۱۴:۱۸", state: "done" }, { title: "آماده‌سازی", detail: "آماده تحویل", time: "۱۴:۲۸", state: "done" }, { title: "تحویل به پیک", detail: "در انتظار تخصیص پیک", time: "—", state: "current" }] },
  { id: "D-1045", customer: "مریم کریمی", channel: "فروشگاه آنلاین", orderType: "ارسال", amount: 380000, status: "delivered", payment: "paid", time: "۱۴:۰۵", items: [{ name: "پیتزا مخصوص", quantity: 1, unitPrice: 265000 }, { name: "چیزکیک", quantity: 1, unitPrice: 115000 }], timeline: [{ title: "ثبت آنلاین", detail: "ثبت از فروشگاه اینترنتی", time: "۱۴:۰۵", state: "done" }, { title: "آماده‌سازی", detail: "تکمیل شد", time: "۱۴:۲۵", state: "done" }, { title: "ارسال", detail: "تحویل مشتری شد", time: "۱۴:۴۵", state: "done" }] },
  { id: "D-1044", customer: "مشتری حضوری", channel: "میز", orderType: "سرو داخل", amount: 144000, status: "cancelled", payment: "refunded", time: "۱۳:۵۲", items: [{ name: "قهوه لاته", quantity: 1, unitPrice: 118000 }, { name: "بستنی", quantity: 1, unitPrice: 26000 }], timeline: [{ title: "ثبت سفارش", detail: "ثبت از میز شماره ۴", time: "۱۳:۵۲", state: "done" }, { title: "لغو سفارش", detail: "لغو نمونه و استرداد نمایشی", time: "۱۴:۰۰", state: "done" }] },
  { id: "D-1043", customer: "رضا احمدی", channel: "تلفنی", orderType: "بیرون‌بر", amount: 303000, status: "preparing", payment: "pending", time: "۱۳:۴۰", items: [{ name: "برگر کلاسیک", quantity: 1, unitPrice: 185000 }, { name: "سیب‌زمینی", quantity: 1, unitPrice: 85000 }, { name: "نوشابه", quantity: 1, unitPrice: 33000 }], timeline: [{ title: "ثبت سفارش", detail: "ثبت تلفنی", time: "۱۳:۴۰", state: "done" }, { title: "آماده‌سازی", detail: "در صف آشپزخانه", time: "۱۳:۴۳", state: "current" }, { title: "تحویل", detail: "در انتظار تحویل", time: "—", state: "pending" }] },
  { id: "D-1042", customer: "مشتری وب", channel: "فروشگاه آنلاین", orderType: "ارسال", amount: 195000, status: "new", payment: "paid", time: "۱۳:۲۸", items: [{ name: "لاته", quantity: 1, options: ["بزرگ", "شیر جو دوسر"], unitPrice: 178000 }, { name: "بستنی", quantity: 1, unitPrice: 17000 }], timeline: [{ title: "ثبت آنلاین", detail: "پرداخت اینترنتی تأییدشده در داده نمونه", time: "۱۳:۲۸", state: "done" }, { title: "تأیید سفارش", detail: "در انتظار تأیید عملیات", time: "—", state: "current" }, { title: "آماده‌سازی", detail: "هنوز آغاز نشده", time: "—", state: "pending" }] },
  { id: "D-1041", customer: "مشتری میز ۲", channel: "میز", orderType: "سرو داخل", amount: 275000, status: "delivered", payment: "partial", time: "۱۳:۱۲", items: [{ name: "پیتزا مخصوص", quantity: 1, unitPrice: 265000 }, { name: "سس اضافه", quantity: 1, unitPrice: 10000 }], timeline: [{ title: "ثبت سفارش", detail: "ثبت از میز شماره ۲", time: "۱۳:۱۲", state: "done" }, { title: "تحویل", detail: "تحویل‌شده؛ مانده پرداخت نیازمند تسویه", time: "۱۳:۴۰", state: "done" }] },
];port { useMemo, useState } from "react";
import { Eye, FilterX, PackageCheck } from "lucide-react";
import {
  Button,
  DataTable,
  Notice,
  SelectField,
  StatusBadge,
  Surface,
  TextField,
} from "../../shared/ui";

type DemoOrder = {
  id: string;
  customer: string;
  channel: string;
  orderType: string;
  amount: number;
  status: "new" | "preparing" | "ready" | "delivered" | "cancelled";
  payment: "paid" | "pending" | "partial" | "refunded";
  time: string;
  items: { name: string; quantity: number; options?: string[]; note?: string; unitPrice: number }[];
  timeline: { title: string; detail: string; time: string; state: "done" | "current" | "pending" }[];
};

const demoOrders: DemoOrder[] = [
  { id: "D-1048", customer: "مشتری حضوری", channel: "صندوق", orderType: "سرو داخل", amount: 438000, status: "preparing", payment: "paid", time: "۱۴:۳۲", items: ["برگر کلاسیک × ۱", "قهوه اسپرسو × ۱", "سیب‌زمینی × ۱"] },
  { id: "D-1047", customer: "سارا محمدی", channel: "تلفنی", orderType: "بیرون‌بر", amount: 530000, status: "new", payment: "pending", time: "۱۴:۲۶", items: ["پیتزا مخصوص × ۲"] },
  { id: "D-1046", customer: "علی رضایی", channel: "صندوق", orderType: "ارسال", amount: 226000, status: "ready", payment: "paid", time: "۱۴:۱۸", items: ["ساندویچ مرغ × ۱", "نوشابه × ۱"] },
  { id: "D-1045", customer: "مریم کریمی", channel: "فروشگاه آنلاین", orderType: "ارسال", amount: 380000, status: "delivered", payment: "paid", time: "۱۴:۰۵", items: ["پیتزا مخصوص × ۱", "چیزکیک × ۱"] },
  { id: "D-1044", customer: "مشتری حضوری", channel: "صندوق", orderType: "سرو داخل", amount: 144000, status: "cancelled", payment: "refunded", time: "۱۳:۵۲", items: ["قهوه لاته × ۱", "بستنی × ۱"] },
  { id: "D-1043", customer: "رضا احمدی", channel: "تلفنی", orderType: "بیرون‌بر", amount: 303000, status: "preparing", payment: "pending", time: "۱۳:۴۰", items: ["برگر کلاسیک × ۱", "سیب‌زمینی × ۱"] },
];

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

const orderStatus: Record<DemoOrder["status"], { label: string; variant: "info" | "warning" | "success" | "danger" | "neutral" }> = {
  new: { label: "جدید", variant: "info" },
  preparing: { label: "در حال آماده‌سازی", variant: "warning" },
  ready: { label: "آماده تحویل", variant: "success" },
  delivered: { label: "تحویل‌شده", variant: "neutral" },
  cancelled: { label: "لغوشده", variant: "danger" },
};

const paymentStatus: Record<DemoOrder["payment"], { label: string; variant: "success" | "warning" | "danger" }> = {
  paid: { label: "پرداخت‌شده", variant: "success" },
  pending: { label: "در انتظار پرداخت", variant: "warning" },
  partial: { label: "پرداخت بخشی", variant: "warning" },
  refunded: { label: "مستردشده", variant: "danger" },
};

export function OrderCenter() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [payment, setPayment] = useState("all");
  const [orderType, setOrderType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa-IR");
    return demoOrders.filter((order) => {
      const matchesQuery = !normalized ||
        `${order.id} ${order.customer} ${order.channel}`.toLocaleLowerCase("fa-IR").includes(normalized);
      return matchesQuery &&
        (status === "all" || order.status === status) &&
        (channel === "all" || order.channel === channel) &&
        (payment === "all" || order.payment === payment) &&
        (orderType === "all" || order.orderType === orderType);
    });
  }, [query, status, channel, payment, orderType]);

  const selectedOrder = demoOrders.find((order) => order.id === selectedId) ?? null;

  const columns = [
    {
      key: "number",
      header: "شماره سفارش",
      render: (order: DemoOrder) => <strong className="orders-number">{order.id}</strong>,
    },
    {
      key: "customer",
      header: "مشتری / کانال",
      render: (order: DemoOrder) => (
        <span className="orders-customer">
          <strong>{order.customer}</strong>
          <small>{order.channel} · {order.orderType}</small>
        </span>
      ),
    },
    {
      key: "time",
      header: "زمان",
      render: (order: DemoOrder) => order.time,
      align: "center" as const,
    },
    {
      key: "amount",
      header: "مبلغ",
      render: (order: DemoOrder) => <strong>{money(order.amount)} تومان</strong>,
      align: "end" as const,
    },
    {
      key: "status",
      header: "وضعیت سفارش",
      render: (order: DemoOrder) => (
        <StatusBadge variant={orderStatus[order.status].variant}>
          {orderStatus[order.status].label}
        </StatusBadge>
      ),
    },
    {
      key: "payment",
      header: "وضعیت پرداخت",
      render: (order: DemoOrder) => (
        <StatusBadge variant={paymentStatus[order.payment].variant}>
          {paymentStatus[order.payment].label}
        </StatusBadge>
      ),
    },
    {
      key: "action",
      header: "جزئیات",
      render: (order: DemoOrder) => (
        <Button
          size="sm"
          variant={selectedId === order.id ? "primary" : "secondary"}
          onClick={() => setSelectedId(selectedId === order.id ? null : order.id)}
          aria-label={`نمایش جزئیات سفارش ${order.id}`}
        >
          <Eye size={14} /> مشاهده
        </Button>
      ),
      align: "center" as const,
    },
  ];

  return (
    <div className="page-stack orders-workspace">
      <div className="orders-page-heading">
        <div>
          <span className="ui-eyebrow">ORDER MANAGEMENT</span>
          <h1>مرکز یکپارچه سفارش‌ها</h1>
          <p>نمایش سفارش‌های صندوق، تلفنی، بیرون‌بر و فروشگاه آنلاین در یک محل</p>
        </div>
        <StatusBadge variant="warning">دموی تعاملی</StatusBadge>
      </div>

      <Notice variant="warning">
        سفارش‌های این صفحه داده نمونه هستند. وضعیت‌ها فقط برای نمایش فیلتر و جزئیات استفاده می‌شوند
        و هیچ تغییری در سیستم واقعی ایجاد نمی‌کنند.
      </Notice>

      <div className="orders-summary-grid">
        <Surface padding="sm"><span>کل سفارش‌های نمونه</span><strong>{money(demoOrders.length)}</strong></Surface>
        <Surface padding="sm"><span>در حال آماده‌سازی</span><strong>{money(demoOrders.filter((item) => item.status === "preparing").length)}</strong></Surface>
        <Surface padding="sm"><span>آماده تحویل</span><strong>{money(demoOrders.filter((item) => item.status === "ready").length)}</strong></Surface>
        <Surface padding="sm"><span>در انتظار پرداخت</span><strong>{money(demoOrders.filter((item) => item.payment === "pending" || item.payment === "partial").length)}</strong></Surface>
      </div>

      <Surface padding="md" className="orders-table-surface">
        <div className="orders-table-heading">
          <div>
            <h2><PackageCheck size={18} /> فهرست سفارش‌ها</h2>
            <p>{money(filteredOrders.length)} سفارش مطابق فیلتر</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setQuery(""); setStatus("all"); setChannel("all"); setPayment("all"); setOrderType("all"); setSelectedId(null); }}
          >
            <FilterX size={14} /> پاک‌کردن فیلترها
          </Button>
        </div>

        <div className="orders-filters">
          <TextField
            label="جست‌وجو"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="شماره سفارش، مشتری یا کانال"
          />
          <SelectField
            label="وضعیت سفارش"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: "all", label: "همه وضعیت‌ها" },
              { value: "new", label: "جدید" },
              { value: "preparing", label: "در حال آماده‌سازی" },
              { value: "ready", label: "آماده تحویل" },
              { value: "delivered", label: "تحویل‌شده" },
              { value: "cancelled", label: "لغوشده" },
            ]}
          />
          <SelectField
            label="کانال سفارش"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            options={[
              { value: "all", label: "همه کانال‌ها" },
              { value: "صندوق", label: "صندوق" },
              { value: "تلفنی", label: "تلفنی" },
              { value: "فروشگاه آنلاین", label: "فروشگاه آنلاین" },
              { value: "میز", label: "میز" },
            ]}
          />
          <SelectField
            label="وضعیت پرداخت"
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
            options={[
              { value: "all", label: "همه وضعیت‌های پرداخت" },
              { value: "paid", label: "پرداخت‌شده" },
              { value: "partial", label: "پرداخت بخشی" },
              { value: "pending", label: "در انتظار پرداخت" },
              { value: "refunded", label: "مستردشده" },
            ]}
          />
          <SelectField
            label="نوع دریافت"
            value={orderType}
            onChange={(event) => setOrderType(event.target.value)}
            options={[
              { value: "all", label: "همه انواع" },
              { value: "سرو داخل", label: "سرو داخل" },
              { value: "بیرون‌بر", label: "بیرون‌بر" },
              { value: "ارسال", label: "ارسال" },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          rows={filteredOrders}
          getRowKey={(order) => order.id}
          emptyMessage="سفارشی با این فیلترها پیدا نشد."
          caption="اطلاعات نمایشی — فاقد اتصال به سرویس سفارش"
        />
      </Surface>

      {selectedOrder ? (
        <Surface padding="md" className="orders-detail">
          <div className="orders-detail-heading">
            <div>
              <span className="ui-eyebrow">ORDER DETAIL</span>
              <h2>جزئیات سفارش {selectedOrder.id}</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>بستن</Button>
          </div>
          <div className="orders-detail-grid">
            <div><span>مشتری</span><strong>{selectedOrder.customer}</strong></div>
            <div><span>کانال ثبت</span><strong>{selectedOrder.channel}</strong></div>
            <div><span>نوع سفارش</span><strong>{selectedOrder.orderType}</strong></div>
            <div><span>زمان ثبت</span><strong>{selectedOrder.time}</strong></div>
            <div><span>وضعیت سفارش</span><StatusBadge variant={orderStatus[selectedOrder.status].variant}>{orderStatus[selectedOrder.status].label}</StatusBadge></div>
            <div><span>وضعیت پرداخت</span><StatusBadge variant={paymentStatus[selectedOrder.payment].variant}>{paymentStatus[selectedOrder.payment].label}</StatusBadge></div>
          </div>
          <div className="orders-detail-items">
            <strong>اقلام سفارش</strong>
            {selectedOrder.items.map((item, index) => (
              <article className="orders-detail-item" key={`${selectedOrder.id}-${index}`}>
                <div><strong>{item.name}</strong><span>{money(item.quantity)} عدد × {money(item.unitPrice)} تومان</span></div>
                {item.options?.length ? <small>انتخاب‌ها: {item.options.join("، ")}</small> : null}
                {item.note ? <small>یادداشت: {item.note}</small> : null}
                <b>{money(item.quantity * item.unitPrice)} تومان</b>
              </article>
            ))}
          </div>
          <div className="orders-timeline">
            <strong>تاریخچه سفارش</strong>
            <ol>{selectedOrder.timeline.map((event, index) => <li className={`is-${event.state}`} key={`${event.title}-${index}`}><span className="orders-timeline-marker" /><div><b>{event.title}</b><small>{event.detail}</small></div><time>{event.time}</time></li>)}</ol>
          </div>
          <div className="orders-detail-total"><span>مبلغ سفارش</span><strong>{money(selectedOrder.amount)} تومان</strong></div>
        </Surface>
      ) : null}
    </div>
  );
}
