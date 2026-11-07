import { productService } from "../products/product.service";
import { inventoryService } from "../inventory/inventory.service";
import { customerService } from "../customers/customer.service";
import { supplierService } from "../suppliers/supplier.service";
import { reportsService, resolveDateRange } from "../reports/reports.service";
import { cashRegisterService } from "../cash-register/cash-register.service";

/**
 * Every tool here is READ-ONLY by design. The assistant answers
 * questions about the store's data; it never creates, edits, or
 * deletes anything. Any action the owner wants to take (recording a
 * sale, a payment, an expense...) still goes through the normal
 * screens, where they see exactly what they're confirming — an AI
 * chat message is not an audit trail a bookkeeper can trust the way a
 * form submission is.
 */
export const assistantTools = [
  {
    name: "get_inventory_status",
    description:
      "يرجع كل المنتجات مع المخزون الحالي وحالة انخفاض المخزون. استخدمه لأسئلة عن الكميات المتوفرة أو المنتجات التي أوشكت على النفاد.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "search_products",
    description: "يبحث عن منتج بالاسم ويرجع سعره ومخزونه الحالي.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "جزء من اسم المنتج" } },
      required: ["query"],
    },
  },
  {
    name: "search_customers",
    description: "يبحث عن زبون بالاسم ويرجع رصيد الدين المستحق عليه.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "جزء من اسم الزبون" } },
      required: ["query"],
    },
  },
  {
    name: "search_suppliers",
    description: "يبحث عن مورد بالاسم ويرجع رصيده الحالي مع المحل.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "جزء من اسم المورد" } },
      required: ["query"],
    },
  },
  {
    name: "get_top_debt_customers",
    description: "يرجع أعلى الزبائن ديناً حالياً (لقطة لحظية، غير مرتبطة بفترة زمنية).",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "عدد النتائج، الافتراضي 5" } },
      required: [],
    },
  },
  {
    name: "get_sales_report",
    description:
      "يرجع ملخص المبيعات (عدد الفواتير، الإيراد، أعلى المنتجات) لفترة زمنية. لو لم تُحدَّد from/to فالافتراضي الشهر الحالي. الصيغة: YYYY-MM-DD.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "تاريخ البداية YYYY-MM-DD" },
        to: { type: "string", description: "تاريخ النهاية YYYY-MM-DD" },
      },
      required: [],
    },
  },
  {
    name: "get_purchases_report",
    description: "يرجع ملخص مشتريات الحليب (الكمية، التكلفة، أعلى الموردين) لفترة زمنية.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "تاريخ البداية YYYY-MM-DD" },
        to: { type: "string", description: "تاريخ النهاية YYYY-MM-DD" },
      },
      required: [],
    },
  },
  {
    name: "get_profit_report",
    description:
      "يرجع الربح التقديري (مبيعات − تكلفة شراء حليب − مصاريف) لفترة زمنية. تقدير مبسّط وليس محاسبة دقيقة.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "تاريخ البداية YYYY-MM-DD" },
        to: { type: "string", description: "تاريخ النهاية YYYY-MM-DD" },
      },
      required: [],
    },
  },
  {
    name: "get_cash_balance",
    description: "يرجع رصيد الصندوق الحالي وإجمالي الداخل/الخارج.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

export async function executeAssistantTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_inventory_status":
      return inventoryService.listStock();

    case "search_products":
      return productService.list(typeof input.query === "string" ? input.query : undefined);

    case "search_customers":
      return customerService.list(typeof input.query === "string" ? input.query : undefined);

    case "search_suppliers":
      return supplierService.list(typeof input.query === "string" ? input.query : undefined);

    case "get_top_debt_customers":
      return reportsService.getTopDebtCustomers(typeof input.limit === "number" ? input.limit : 5);

    case "get_sales_report": {
      const { from, to } = resolveDateRange(input.from as string | undefined, input.to as string | undefined);
      return reportsService.getSalesReport(from, to);
    }

    case "get_purchases_report": {
      const { from, to } = resolveDateRange(input.from as string | undefined, input.to as string | undefined);
      return reportsService.getPurchasesReport(from, to);
    }

    case "get_profit_report": {
      const { from, to } = resolveDateRange(input.from as string | undefined, input.to as string | undefined);
      return reportsService.getProfitReport(from, to);
    }

    case "get_cash_balance":
      return cashRegisterService.getSummary();

    default:
      throw new Error(`Unknown assistant tool: ${name}`);
  }
}
