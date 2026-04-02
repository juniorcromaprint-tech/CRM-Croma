import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Servicos from "./components/Servicos";
import Portfolio from "./components/Portfolio";
import Clientes from "./components/Clientes";
import Sobre from "./components/Sobre";
import ComoFunciona from "./components/ComoFunciona";
import CTAFinal from "./components/CTAFinal";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Toaster position="top-center" richColors />
      <Navbar />
      <main>
        <Hero />
        <Servicos />
        <Portfolio />
        <Clientes />
        <Sobre />
        <ComoFunciona />
        <CTAFinal />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
