import Image from "next/image";

export function Ruta3DMark({ className = "" }: { className?: string }) {
  return (
    <span className={`ruta-logo-mark ${className}`} aria-hidden="true">
      <span className="ruta-logo-symbol">
        <Image src="/ruta-3d-logo.png" alt="" width={480} height={630} priority />
      </span>
      <span className="ruta-logo-word">Ruta<mark>3D</mark></span>
    </span>
  );
}
