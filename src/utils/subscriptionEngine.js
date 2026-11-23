export const DEFAULT_BATCH_RULES = [
  {
    id: 'rising_star_young',
    categoryEn: 'Rising Star (2015–2024)',
    categoryBn: 'রাইজিং স্টার (২০১৫–২০২৪)',
    groupEn: 'Rising Star',
    groupBn: 'রাইজিং স্টার',
    minBatch: 2015,
    maxBatch: 2030,
    fullSubscription: 50000,
    firstMonthPayment: 2000,
    monthlyInstallment: 1000,
    stepAfterMonth: 24,
    steppedMonthlyInstallment: 2000,
    totalInstallments: 36,
    summaryEn: 'Months 1–24: BDT 1,000 · Months 25–36: BDT 2,000',
    summaryBn: '১–২৪তম কিস্তি: ১,০০০ টাকা · ২৫–৩৬তম কিস্তি: ২,০০০ টাকা',
  },
  {
    id: 'rising_star_senior',
    categoryEn: 'Rising Star (2009–2014)',
    categoryBn: 'রাইজিং স্টার (২০০৯–২০১৪)',
    groupEn: 'Rising Star',
    groupBn: 'রাইজিং স্টার',
    minBatch: 2009,
    maxBatch: 2014,
    fullSubscription: 50000,
    firstMonthPayment: 5000,
    monthlyInstallment: 1500,
    stepAfterMonth: null,
    steppedMonthlyInstallment: null,
    totalInstallments: 30,
    summaryEn: 'BDT 1,500 / month',
    summaryBn: '১,৫০০ টাকা / মাস',
  },
  {
    id: 'classic',
    categoryEn: 'Classic (1980–2008)',
    categoryBn: 'ক্লাসিক (১৯৮০–২০০৮)',
    groupEn: 'Classic',
    groupBn: 'ক্লাসিক',
    minBatch: 1980,
    maxBatch: 2008,
    fullSubscription: 50000,
    firstMonthPayment: 5000,
    monthlyInstallment: 2000,
    stepAfterMonth: null,
    steppedMonthlyInstallment: null,
    totalInstallments: 24,
    summaryEn: 'BDT 2,000 / month',
    summaryBn: '২,০০০ টাকা / মাস',
  },
  {
    id: 'legacy',
    categoryEn: 'Legacy (1958–1979)',
    categoryBn: 'লিগ্যাসি (১৯৫৮–১৯৭৯)',
    groupEn: 'Legacy',
    groupBn: 'লিগ্যাসি',
    minBatch: 1958,
    maxBatch: 1979,
    fullSubscription: 50000,
    firstMonthPayment: 5000,
    monthlyInstallment: 2000,
    stepAfterMonth: null,
    steppedMonthlyInstallment: null,
    totalInstallments: 24,
    summaryEn: 'BDT 2,000 / month',
    summaryBn: '২,০০০ টাকা / মাস',
  },
];

export function getBatchRule(batchYear, rules = DEFAULT_BATCH_RULES) {
  const year = Number(batchYear);
  if (!year) return rules[0];
  const matched = rules.find((r) => year >= r.minBatch && year <= r.maxBatch);
  if (matched) return matched;
  if (year > 2024) return rules[0];
  return rules[rules.length - 1];
}

export function addMonthsToYYYYMM(startYYYYMM, offset) {
  const [yStr, mStr] = (startYYYYMM || '2027-01').split('-');
  const year = Number(yStr) || 2027;
  const monthIndex = (Number(mStr) || 1) - 1 + offset;
  const d = new Date(year, monthIndex, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_BN = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

export function formatMonthLabel(yyyyMm, lang = 'en') {
  if (!yyyyMm || !yyyyMm.includes('-')) return yyyyMm || '';
  const [y, m] = yyyyMm.split('-');
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${lang === 'bn' ? MONTH_NAMES_BN[idx] : MONTH_NAMES_EN[idx]} ${y}`;
}

/**
 * Generates the exact payment schedule for a member starting from settings.installmentStartMonth (default 2027-01).
 * - January 2027 (offset 0) = First-Month Payment
 * - February 2027 onwards (offset 1..N) = Installment #1 .. Installment #N
 */
export function generateMemberSchedule(member, plan, settings) {
  const startMonth = settings?.installmentStartMonth || '2027-01';
  const rules = settings?.batchRules || DEFAULT_BATCH_RULES;
  const batchRule = getBatchRule(member?.batch, rules);

  if (!plan) {
    return { mode: 'full', batchRule, items: [], totalPayable: 0 };
  }

  // Honorary / Free member
  if (Number(plan.fee) === 0) {
    return {
      mode: 'free',
      batchRule,
      items: [],
      totalPayable: 0,
    };
  }

  const canUseInstallment = Boolean(plan.allowInstallment);
  const useInstallment = canUseInstallment && member?.paymentMode !== 'full';

  if (!useInstallment) {
    return {
      mode: 'full',
      batchRule,
      totalPayable: Number(plan.fee),
      items: [
        {
          index: 0,
          type: 'full',
          month: startMonth,
          labelEn: 'Full Subscription Payment',
          labelBn: 'সম্পূর্ণ সাবস্ক্রিপশন ফি',
          amount: Number(plan.fee),
        },
      ],
    };
  }

  const items = [];
  // Step 0: First-Month Payment (January 2027)
  items.push({
    index: 0,
    type: 'first_month',
    month: addMonthsToYYYYMM(startMonth, 0),
    labelEn: 'First-Month Payment',
    labelBn: 'প্রথম মাসের পেমেন্ট',
    amount: Number(batchRule.firstMonthPayment),
  });

  // Steps 1..N: Monthly Installments starting February 2027
  const totalInst = Number(batchRule.totalInstallments) || 24;
  for (let i = 1; i <= totalInst; i++) {
    const isStepped =
      batchRule.stepAfterMonth &&
      batchRule.steppedMonthlyInstallment &&
      i > Number(batchRule.stepAfterMonth);
    const amount = isStepped
      ? Number(batchRule.steppedMonthlyInstallment)
      : Number(batchRule.monthlyInstallment);

    items.push({
      index: i,
      type: 'installment',
      installmentNo: i,
      month: addMonthsToYYYYMM(startMonth, i),
      labelEn: `Installment #${i}`,
      labelBn: `কিস্তি #${i}`,
      amount,
    });
  }

  const totalPayable = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    mode: 'installment',
    batchRule,
    totalPayable,
    items,
  };
}
