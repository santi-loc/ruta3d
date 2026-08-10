import { catalogProducts } from "@/lib/catalog";
import { PrinterGuide } from "../printer-guide";

export default function PrinterGuidePage() {
  return <PrinterGuide products={catalogProducts} />;
}
