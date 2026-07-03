import React from "react";
import { Link } from "react-router-dom";
import { Instagram, MessageCircle } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import TrackingLoader from "@/components/marketplace/TrackingLoader";

const WHATSAPP_URL =
  "https://wa.me/5531998416336?text=Ol%C3%A1!%20Tenho%20interesse%20no%20marketplace%20da%20AD%20SCALE";
const INSTAGRAM_URL = "https://instagram.com/adscale";

const SEO_KEYWORDS: string[] = [
  "comprar bm verificada","bm verificada","bm verificada comprar","comprar bm verificada facebook",
  "bm verificada facebook","comprar bm","comprar bm facebook","comprar bm facebook ads",
  "comprar bm ilimitada","bm ilimitada","bm com gastos","bm contingencia","bm contingência",
  "contingência meta ads","contingencia meta ads","contingência facebook ads","contingencia facebook ads",
  "contingência facebook ads comprar","contingência facebook","contingencia facebook","contingência meta",
  "contingencia meta","fornecedor de bm","fornecedor bm verificada","fornecedor de contas de anúncio",
  "qualidade da conta meta","qualidade da conta meta ads","qualidade da conta","qualidade conta facebook ads",
  "meta account quality","account quality","account quality facebook","trust tier facebook",
  "trust tier meta ads","trust tier meta","auditoria do facebook","auditoria conta facebook ads",
  "auditoria meta ads","consultoria de facebook ads","consultoria facebook ads","consultoria meta ads",
  "consultoria de tráfego pago","aluguel de bm","aluguel de conta de anúncio","aluguel bm verificada",
  "alugar bm facebook","alugar conta de anúncio facebook","alugar conta meta ads",
  "conta de anúncio facebook","conta de anúncio meta","conta de anúncio bloqueada",
  "conta anúncio bloqueada facebook","desbloquear conta de anúncio facebook",
  "recuperar conta de anúncio meta","reativar conta de anúncio facebook","bm bloqueada facebook",
  "bm bloqueada meta","bm banida recuperar","business manager bloqueado","business manager verificado",
  "business manager comprar","business manager ilimitado","business manager com limite alto",
  "bm com limite alto","bm sem limite","bm gastos altos","bm alta qualidade","bm antiga",
  "bm envelhecida","bm aquecida","conta antiga facebook ads","conta envelhecida facebook ads",
  "conta aquecida meta ads","perfil facebook para bm","perfil aquecido facebook",
  "perfil antigo facebook anúncios","página antiga facebook","página facebook para anúncios",
  "página verificada facebook comprar","estrutura para tráfego pago","estrutura anti bloqueio meta ads",
  "estrutura contingência facebook","escalar facebook ads","escalar meta ads","escalar tráfego pago",
  "lateralização de contas facebook","reposição de bm","reposição de conta de anúncio",
  "gestor de tráfego contingência","agência de tráfego pago","serviços meta ads","serviços facebook ads",
  "proxy para facebook ads","multilogin para facebook ads","anti detect facebook ads",
  "tráfego pago escala","tráfego pago black","tráfego pago contingência",
  "marketplace de contas de anúncio","marketplace bm verificada",
];

const MarketplaceFooter: React.FC = () => {
  return (
    <>
    <TrackingLoader />
    <footer className="relative border-t border-border/60 mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Logo centered */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <Link
            to="/marketplace"
            className="inline-flex items-center notranslate"
            translate="no"
            aria-label="AD SCALE"
          >
            <AdScaleLogo size={32} />
          </Link>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12 text-center sm:text-left">
          {/* Políticas */}
          <div>
            <h4 className="font-display font-bold text-foreground text-sm sm:text-base mb-3 sm:mb-4">
              Políticas
            </h4>
            <ul className="space-y-2 sm:space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="/advertising-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  Política de Publicidade
                </a>
              </li>
              <li>
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>

          {/* Suporte */}
          <div>
            <h4 className="font-display font-bold text-foreground text-sm sm:text-base mb-3 sm:mb-4">
              Suporte
            </h4>
            <ul className="space-y-2 sm:space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center sm:justify-start gap-1.5 hover:text-foreground transition-colors"
                >
                  <MessageCircle size={14} /> Atendimento via WhatsApp
                </a>
              </li>
              <li>Segunda a Sexta: 10h às 22h</li>
              <li>Sábado e Domingo: 10h às 20h</li>
            </ul>
          </div>

          {/* Links Rápidos */}
          <div className="sm:col-span-2 md:col-span-1">
            <h4 className="font-display font-bold text-foreground text-sm sm:text-base mb-3 sm:mb-4">
              Links Rápidos
            </h4>
            <ul className="space-y-2 sm:space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/marketplace/produtos" className="hover:text-foreground transition-colors">
                  Produtos
                </Link>
              </li>
              <li>
                <Link to="/marketplace/ativos" className="hover:text-foreground transition-colors">
                  Ativos c/ Gastos
                </Link>
              </li>
              <li>
                <Link to="/meus-pedidos" className="hover:text-foreground transition-colors">
                  Meus Pedidos
                </Link>
              </li>
              <li>
                <Link to="/perfil" className="hover:text-foreground transition-colors">
                  Perfil
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 sm:my-10 border-t border-border/60" />

        {/* Instagram */}
        <div className="flex justify-center mb-8">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
          >
            <Instagram size={18} />
            Siga-nos no Instagram
          </a>
        </div>

        {/* Legal */}
        <div className="text-center space-y-1.5 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="notranslate" translate="no">AD SCALE</span>. Todos os direitos reservados.
          </p>
          <p>Marketplace de ativos para tráfego pago.</p>
        </div>
      </div>
    </footer>
    </>
  );
};

export default MarketplaceFooter;
