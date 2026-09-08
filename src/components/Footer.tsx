import { Link } from "@tanstack/react-router";

const Footer = () => {
  return (
    <footer className="tim-section-blue">
      <div className="section-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-1.5 font-extrabold text-2xl mb-4">
              <span className="text-tim-red">≡</span>
              <span className="text-primary-foreground">TIM</span>
            </Link>
            <p className="text-sm text-primary-foreground/60 leading-relaxed max-w-xs">
              A forma mais rápida e segura de recarregar seu celular TIM.
              Praticidade e confiança em cada recarga.
            </p>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 text-left text-xs leading-6 text-primary-foreground">
          © TIM S/A. Todos os direitos reservados. CNPJ: 02.421.421/0001-11 -
          Insc. Municipal: 0261388-3 - Insc. Estadual: 86.092.08-5 Av João
          Cabral de Mello Neto, 850 - Bl 01 - Salas 501 a 1208. Barra da
          Tijuca - Rio de Janeiro - RJ - CEP: 22775-057
        </div>
      </div>
    </footer>
  );
};

export default Footer;
