export interface StandupField {
  key: string;
  label: string;
  hint?: string;
  type: 'text' | 'textarea';
  required?: boolean;
}

export interface StandupSection {
  id: string;
  section: string;
  fields: StandupField[];
}

type StandupQuestionsMap = Record<string, Record<string, StandupSection[]>>;

export const STANDUP_QUESTIONS: StandupQuestionsMap = {
  creative: {
    pagi: [
      {
        id: 'planning',
        section: 'Planning Hari Ini',
        fields: [
          { key: 'konten_plan', label: 'Konten apa yang akan dibuat/difinalisasi hari ini?', hint: 'Sebutkan judul atau konsep konten', type: 'textarea' },
          { key: 'platform_target', label: 'Platform target (IG, TikTok, dsb)', type: 'text' },
          { key: 'deadline_konten', label: 'Ada deadline konten hari ini?', type: 'text' },
        ],
      },
      {
        id: 'progress',
        section: 'Progress & Hambatan',
        fields: [
          { key: 'progress_ongoing', label: 'Progress konten yang sedang berjalan', type: 'textarea' },
          { key: 'hambatan', label: 'Hambatan / blocking issue hari ini?', type: 'textarea' },
          { key: 'butuh_support', label: 'Butuh support dari tim lain?', type: 'text' },
        ],
      },
    ],
    sore: [
      {
        id: 'review',
        section: 'Review Hari Ini',
        fields: [
          { key: 'konten_selesai', label: 'Konten apa yang berhasil diselesaikan hari ini?', type: 'textarea' },
          { key: 'konten_pending', label: 'Konten yang belum selesai & alasannya', type: 'textarea' },
          { key: 'feedback_konten', label: 'Ada feedback dari atasan/klien untuk konten?', type: 'textarea' },
        ],
      },
      {
        id: 'refleksi',
        section: 'Refleksi',
        fields: [
          { key: 'win_hari_ini', label: 'Win terbesar hari ini', type: 'text' },
          { key: 'perbaikan', label: 'Apa yang bisa diperbaiki besok?', type: 'textarea' },
        ],
      },
    ],
  },

  public_relation: {
    pagi: [
      {
        id: 'campaign',
        section: 'Campaign & Affiliator',
        fields: [
          { key: 'campaign_aktif', label: 'Campaign / kolaborasi yang aktif hari ini', type: 'textarea' },
          { key: 'target_reach', label: 'Target reach / engagement hari ini', type: 'text' },
          { key: 'affiliator_followup', label: 'Affiliator yang perlu di-follow up hari ini', type: 'textarea' },
        ],
      },
      {
        id: 'hambatan',
        section: 'Hambatan',
        fields: [
          { key: 'hambatan', label: 'Hambatan / blocking issue', type: 'textarea' },
          { key: 'butuh_support', label: 'Butuh support dari tim lain?', type: 'text' },
        ],
      },
    ],
    sore: [
      {
        id: 'hasil',
        section: 'Hasil Hari Ini',
        fields: [
          { key: 'hasil_campaign', label: 'Hasil campaign / reach hari ini (aktual)', type: 'textarea' },
          { key: 'affiliator_respond', label: 'Respons affiliator yang dikontrak', type: 'textarea' },
          { key: 'isu_pr', label: 'Isu atau krisis PR yang muncul?', type: 'textarea' },
        ],
      },
      {
        id: 'followup',
        section: 'Follow-up',
        fields: [
          { key: 'followup_besok', label: 'Follow-up penting untuk besok', type: 'textarea' },
          { key: 'notes_tambahan', label: 'Catatan tambahan', type: 'textarea' },
        ],
      },
    ],
  },

  admin_marketplace: {
    pagi: [
      {
        id: 'target',
        section: 'Target & Persiapan',
        fields: [
          { key: 'target_order', label: 'Target order masuk hari ini', type: 'text' },
          { key: 'status_iklan', label: 'Status iklan yang berjalan', type: 'textarea' },
          { key: 'promo_aktif', label: 'Promo / voucher aktif hari ini', type: 'text' },
        ],
      },
      {
        id: 'hambatan',
        section: 'Hambatan',
        fields: [
          { key: 'hambatan', label: 'Hambatan / blocking issue', type: 'textarea' },
          { key: 'stok_kritis', label: 'Ada produk stok kritis?', type: 'text' },
        ],
      },
    ],
    sore: [
      {
        id: 'review',
        section: 'Review Performa',
        fields: [
          { key: 'review_performa', label: 'Review performa iklan hari ini', type: 'textarea' },
          { key: 'isu_operasional', label: 'Isu operasional (retur, komplain, dsb)', type: 'textarea' },
          { key: 'perbaikan_besok', label: 'Action untuk besok', type: 'textarea' },
        ],
      },
    ],
  },

  rnd: {
    pagi: [
      {
        id: 'pipeline',
        section: 'Pipeline & Task',
        fields: [
          { key: 'pipeline_status', label: 'Status pipeline produk yang sedang berjalan', type: 'textarea' },
          { key: 'task_hari_ini', label: 'Task R&D hari ini', type: 'textarea' },
          { key: 'target_milestone', label: 'Milestone yang ingin dicapai hari ini', type: 'text' },
        ],
      },
      {
        id: 'resource',
        section: 'Hambatan & Resource',
        fields: [
          { key: 'hambatan', label: 'Hambatan / blocking issue', type: 'textarea' },
          { key: 'butuh_resource', label: 'Resource / support yang dibutuhkan', type: 'text' },
        ],
      },
    ],
    sore: [
      {
        id: 'progress',
        section: 'Progress & Temuan',
        fields: [
          { key: 'progress_achieved', label: 'Progress yang dicapai hari ini', type: 'textarea' },
          { key: 'temuan_riset', label: 'Temuan riset / testing hari ini', type: 'textarea' },
          { key: 'update_pipeline', label: 'Update status pipeline produk', type: 'textarea' },
        ],
      },
      {
        id: 'next',
        section: 'Rencana Selanjutnya',
        fields: [
          { key: 'next_step', label: 'Next step / rencana besok', type: 'textarea' },
          { key: 'eskalasi', label: 'Perlu eskalasi ke atasan?', type: 'text' },
        ],
      },
    ],
  },

  brand_manager: {
    pagi: [
      {
        id: 'prioritas',
        section: 'Prioritas & Agenda',
        fields: [
          { key: 'prioritas', label: 'Top 3 prioritas brand hari ini', type: 'textarea' },
          { key: 'meeting_agenda', label: 'Meeting / agenda penting hari ini', type: 'text' },
          { key: 'isu_urgent', label: 'Isu urgent yang perlu diselesaikan', type: 'textarea' },
        ],
      },
      {
        id: 'koordinasi',
        section: 'Koordinasi',
        fields: [
          { key: 'koordinasi_tim', label: 'Koordinasi dengan tim mana hari ini?', type: 'text' },
          { key: 'hambatan', label: 'Hambatan level brand', type: 'textarea' },
        ],
      },
    ],
    sore: [
      {
        id: 'pencapaian',
        section: 'Pencapaian & Eskalasi',
        fields: [
          { key: 'pencapaian', label: 'Pencapaian brand hari ini', type: 'textarea' },
          { key: 'isu_eskalasi', label: 'Isu yang perlu dieskalasi ke owner', type: 'textarea' },
          { key: 'catatan_tim', label: 'Catatan performa tim hari ini', type: 'textarea' },
        ],
      },
    ],
  },

  owner: {
    pagi: [
      {
        id: 'fokus',
        section: 'Fokus Hari Ini',
        fields: [
          { key: 'fokus_hari_ini', label: 'Fokus utama holding hari ini', type: 'textarea' },
          { key: 'brand_perlu_perhatian', label: 'Brand yang perlu perhatian khusus hari ini', type: 'text' },
        ],
      },
    ],
    sore: [
      {
        id: 'review',
        section: 'Review & Keputusan',
        fields: [
          { key: 'overall_review', label: 'Overall review performa hari ini', type: 'textarea' },
          { key: 'keputusan_strategis', label: 'Keputusan strategis yang dibuat hari ini', type: 'textarea' },
        ],
      },
    ],
  },

  admin: {
    pagi: [
      {
        id: 'fokus',
        section: 'Fokus Hari Ini',
        fields: [
          { key: 'fokus_hari_ini', label: 'Fokus utama hari ini', type: 'textarea' },
          { key: 'prioritas', label: 'Top 3 prioritas', type: 'textarea' },
        ],
      },
    ],
    sore: [
      {
        id: 'review',
        section: 'Review',
        fields: [
          { key: 'pencapaian', label: 'Pencapaian hari ini', type: 'textarea' },
          { key: 'catatan', label: 'Catatan penting', type: 'textarea' },
        ],
      },
    ],
  },
};

// ─── DAILY LOG CONFIG ──────────────────────────────────────────────────────────

export interface DailyLogRow {
  key: string;
  label: string;
  unit: 'currency' | 'number' | 'text' | 'status';
  placeholder?: string;
}

export interface DailyLogConfig {
  title: string;
  columns: string[];
  rows: DailyLogRow[];
}

export const DAILY_LOG_CONFIG: Record<string, DailyLogConfig> = {
  brand_manager: {
    title: 'Daily KPI Log — Brand Manager',
    columns: ['Metrik', 'Aktual', 'Catatan'],
    rows: [
      { key: 'omzet_shopee', label: 'Omzet Shopee (Rp)', unit: 'currency', placeholder: '14000000' },
      { key: 'omzet_tiktok', label: 'Omzet TikTok Shop (Rp)', unit: 'currency', placeholder: '8000000' },
      { key: 'omzet_tokopedia', label: 'Omzet Tokopedia (Rp)', unit: 'currency', placeholder: '5000000' },
      { key: 'roas_iklan', label: 'ROAS Iklan', unit: 'number', placeholder: '3.2' },
      { key: 'rating_toko', label: 'Rating Toko Rata-rata', unit: 'number', placeholder: '4.8' },
      { key: 'campaign_aktif', label: 'Campaign Aktif (jumlah)', unit: 'number', placeholder: '5' },
    ],
  },

  admin_marketplace: {
    title: 'Daily Log — Marketplace Metrics',
    columns: ['Metrik', 'Aktual', 'Catatan'],
    rows: [
      { key: 'total_order', label: 'Total Order Masuk', unit: 'number', placeholder: '150' },
      { key: 'order_selesai', label: 'Order Selesai / Terproses', unit: 'number', placeholder: '140' },
      { key: 'order_cancel', label: 'Order Cancel / Retur', unit: 'number', placeholder: '3' },
      { key: 'iklan_spend', label: 'Iklan Spend (Rp)', unit: 'currency', placeholder: '500000' },
      { key: 'iklan_revenue', label: 'Revenue dari Iklan (Rp)', unit: 'currency', placeholder: '2000000' },
      { key: 'roas_daily', label: 'ROAS Harian', unit: 'number', placeholder: '4.0' },
      { key: 'produk_terjual', label: 'Produk Terjual (SKU)', unit: 'number', placeholder: '80' },
    ],
  },

  public_relation: {
    title: 'Daily Affiliator Log',
    columns: ['Metrik', 'Aktual', 'Catatan'],
    rows: [
      { key: 'affiliator_aktif_count', label: 'Affiliator Aktif Posting', unit: 'number', placeholder: '12' },
      { key: 'affiliator_baru_count', label: 'Affiliator Baru Direkrut', unit: 'number', placeholder: '3' },
      { key: 'followup_count', label: 'Follow-up Dilakukan', unit: 'number', placeholder: '10' },
      { key: 'isu_pr', label: 'Isu PR Hari Ini', unit: 'text', placeholder: 'Tidak ada isu' },
    ],
  },

  creative: {
    title: 'Daily Log — Creative Output',
    columns: ['Konten', 'Platform', 'Status', 'Catatan'],
    rows: [
      { key: 'konten_1', label: 'Konten 1', unit: 'status' },
      { key: 'konten_2', label: 'Konten 2', unit: 'status' },
      { key: 'konten_3', label: 'Konten 3', unit: 'status' },
      { key: 'konten_4', label: 'Konten 4', unit: 'status' },
      { key: 'konten_5', label: 'Konten 5', unit: 'status' },
    ],
  },

  rnd: {
    title: 'Daily Log — R&D Pipeline',
    columns: ['Produk / Task', 'Status', 'Progress (%)', 'Catatan'],
    rows: [
      { key: 'produk_1', label: 'Produk / Pipeline 1', unit: 'status' },
      { key: 'produk_2', label: 'Produk / Pipeline 2', unit: 'status' },
      { key: 'produk_3', label: 'Produk / Pipeline 3', unit: 'status' },
      { key: 'testing_1', label: 'Testing Item 1', unit: 'status' },
      { key: 'testing_2', label: 'Testing Item 2', unit: 'status' },
    ],
  },
};

export const CONTENT_STATUS_OPTIONS = ['selesai', 'in_progress', 'pending', 'cancel'];

export function getStandupQuestions(role: string, session: string): StandupSection[] {
  return STANDUP_QUESTIONS[role]?.[session] || STANDUP_QUESTIONS['owner']?.[session] || [];
}

export function getDailyLogConfig(role: string): DailyLogConfig | null {
  return DAILY_LOG_CONFIG[role] || null;
}
