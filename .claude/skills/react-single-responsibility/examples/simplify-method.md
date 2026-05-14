# Simplify a Method — Before / After

## Scenario: Long function with multiple positional params

---

### Before

```ts
// order.service.ts
export const processOrder = async (userId: string, items: Item[], couponCode: string, sendEmail: boolean, notifySlack: boolean) => {
  // validate
  if (!userId) throw new Error('userId required');
  if (!items.length) throw new Error('items required');
  let discount = 0;
  if (couponCode) {
    const coupon = await db.coupons.findOne({ code: couponCode });
    if (!coupon || coupon.expired) throw new Error('invalid coupon');
    discount = coupon.discountPercent;
  }

  // compute total
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal * (1 - discount / 100);

  // persist
  const order = await db.orders.create({ userId, items, total, couponCode });

  // notify
  if (sendEmail) {
    await emailService.send({ to: userId, subject: 'Order confirmed', body: `Total: ${total}` });
  }
  if (notifySlack) {
    await slackService.post(`New order ${order.id} for user ${userId}`);
  }

  return order;
};
```

Problems: 5 positional params, ~30 lines mixing validate / compute / persist / notify.

---

### After

**Step 1 — Params object + interface immediately above**:

```ts
interface ProcessOrderArgs {
  userId: string;
  items: Item[];
  couponCode?: string;
  sendEmail?: boolean;
  notifySlack?: boolean;
}
```

**Step 2 — Extract each concern into a named function**:

```ts
// order.service.ts

interface ValidateOrderArgs { userId: string; items: Item[]; }

const validateOrder = ({ userId, items }: ValidateOrderArgs): void => {
  if (!userId) throw new Error('userId required');
  if (!items.length) throw new Error('items required');
};

interface ResolveCouponArgs { couponCode?: string; }

const resolveCoupon = async ({ couponCode }: ResolveCouponArgs): Promise<number> => {
  if (!couponCode) return 0;
  const coupon = await db.coupons.findOne({ code: couponCode });
  if (!coupon || coupon.expired) throw new Error('invalid coupon');
  return coupon.discountPercent;
};

interface ComputeTotalArgs { items: Item[]; discountPercent: number; }

const computeTotal = ({ items, discountPercent }: ComputeTotalArgs): number => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return subtotal * (1 - discountPercent / 100);
};

interface NotifyArgs { orderId: string; userId: string; total: number; sendEmail: boolean; notifySlack: boolean; }

const notifyChannels = async ({ orderId, userId, total, sendEmail, notifySlack }: NotifyArgs): Promise<void> => {
  if (sendEmail) {
    await emailService.send({ to: userId, subject: 'Order confirmed', body: `Total: ${total}` });
  }
  if (notifySlack) {
    await slackService.post(`New order ${orderId} for user ${userId}`);
  }
};
```

**Step 3 — Lean orchestrator**:

```ts
interface ProcessOrderArgs {
  userId: string;
  items: Item[];
  couponCode?: string;
  sendEmail?: boolean;
  notifySlack?: boolean;
}

export const processOrder = async ({
  userId,
  items,
  couponCode,
  sendEmail = false,
  notifySlack = false,
}: ProcessOrderArgs) => {
  validateOrder({ userId, items });
  const discountPercent = await resolveCoupon({ couponCode });
  const total = computeTotal({ items, discountPercent });
  const order = await db.orders.create({ userId, items, total, couponCode });
  await notifyChannels({ orderId: order.id, userId, total, sendEmail, notifySlack });
  return order;
};
```

---

### What changed

| Before | After |
|--------|-------|
| 5 positional params | 1 params object, destructured |
| ~30-line function | Orchestrator reads like a 5-step checklist |
| All concerns inlined | `validateOrder`, `resolveCoupon`, `computeTotal`, `notifyChannels` — each testable in isolation |
| Boolean flags `fn(id, items, code, true, false)` | Named flags: `{ sendEmail: true, notifySlack: false }` |
| Interface for params absent | Interface `ProcessOrderArgs` (and one per helper) immediately above each function |
