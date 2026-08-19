import Image from "next/image";
import type { Product } from "@/lib/catalog";
import { outboundProductUrl } from "@/lib/outbound-links";

type ProductCardProps = {
  product: Product;
  priceFormatter: Intl.NumberFormat;
};

export function ProductCard({ product, priceFormatter }: ProductCardProps) {
  return (
    <article className="product-card">
      <div className="product-visual" style={{ backgroundColor: product.color }}>
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            referrerPolicy="no-referrer"
            sizes="(max-width: 760px) 100vw, 104px"
          />
        ) : (
          <span>{product.category.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="product-info">
        <div className="product-head">
          <div>
            <p>
              {product.store} - {product.storeLocationSummary} - {product.source === "scraper" ? "dato real" : "demo"}
            </p>
            <h3>{product.name}</h3>
          </div>
          <span className={`stock ${product.stock === "En stock" ? "ok" : ""}`}>{product.stock}</span>
        </div>
        <div className="tag-row">
          {product.tags.map((tag, index) => (
            <span key={`${product.id}-${tag}-${index}`}>{tag}</span>
          ))}
        </div>
        <div className="product-foot">
          <div>
            <strong>{priceFormatter.format(product.bestPrice)}</strong>
            <span className="price-label">
              {product.transferPrice ? "Medio de pago: transferencia" : "Medio de pago: precio de lista"}
            </span>
            {product.previousPrice ? <small>{priceFormatter.format(product.previousPrice)}</small> : null}
            {product.transferPrice ? (
              <small className="list-price">{priceFormatter.format(product.price)} precio lista</small>
            ) : null}
          </div>
          <div className="meta">
            <span>{product.shipping}</span>
            <span>{product.updated}</span>
          </div>
          <a
            href={outboundProductUrl(product, "product-card")}
            target="_blank"
            rel="noreferrer"
            aria-label={`Ver ${product.name} en ${product.store}`}
          >
            Ver oferta
          </a>
        </div>
      </div>
    </article>
  );
}
