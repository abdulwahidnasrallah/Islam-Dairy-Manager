// ESM loader hooks: lets Node run the REAL backend service files (TypeScript is
// stripped natively by Node >= 22.18) while replacing only their database-facing
// imports with the in-memory fakes in fakes.mjs. No npm packages needed.
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FAKES = pathToFileURL(path.join(ROOT, "tests/scenario/fakes.mjs")).href;
const SERVICES = path.join(ROOT, "apps/backend/src/modules");

const faked = {
  "payment.repository": "paymentRepoModule",
  "purchase-invoice.repository": "invoiceRepoModule",
  "supplier.service": "supplierServiceModule",
  "audit.service": "auditModule",
  "product.service": "productServiceModule",
  "inventory.repository": "inventoryRepoModule",
  "settings.service": "settingsModule",
};

export async function resolve(specifier, context, next) {
  if (specifier === "@idm/shared-utils") {
    return { url: pathToFileURL(path.join(ROOT, "packages/shared-utils/src/index.ts")).href, shortCircuit: true };
  }
  const base = specifier.split("/").pop();
  if (specifier.startsWith(".") && faked[base] && context.parentURL?.includes("/apps/backend/")) {
    return { url: `${FAKES}?m=${faked[base]}`, shortCircuit: true };
  }
  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
    const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier + ".ts");
    if (fs.existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith(FAKES + "?m=")) {
    const name = new URL(url).searchParams.get("m");
    return { format: "module", shortCircuit: true, source: `import * as f from ${JSON.stringify(FAKES)}; export const { ${EXPORTS[name].join(", ")} } = f.${name};` };
  }
  return next(url, context);
}

const EXPORTS = {
  paymentRepoModule: ["supplierPaymentRepository"],
  invoiceRepoModule: ["purchaseInvoiceRepository"],
  supplierServiceModule: ["supplierService"],
  auditModule: ["auditService"],
  productServiceModule: ["productService"],
  inventoryRepoModule: ["inventoryRepository"],
  settingsModule: ["settingsService"],
};
