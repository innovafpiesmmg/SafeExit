import asdLogo from "@assets/ASD_1772649413507.png";

export function Footer() {
  return (
    <footer className="py-2 px-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60 select-none">
      <img src={asdLogo} alt="ASD" className="h-4 w-auto" />
      <span>Creado por Atrreyu Servicios Digitales</span>
    </footer>
  );
}
