import { Link } from "wouter";
import { ArrowRight, BookOpen, Brain, FileText, BarChart3, Users, CheckCircle, Zap, Shield, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const HERO_IMG = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920&q=85&auto=format&fit=crop";
const FEATURE_IMG_1 = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format&fit=crop";
const FEATURE_IMG_2 = "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=800&q=80&auto=format&fit=crop";
const FEATURE_IMG_3 = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&auto=format&fit=crop";

const features = [
  {
    icon: Brain,
    title: "Generación con IA",
    desc: "Crea universos contables completos y coherentes en segundos usando inteligencia artificial de última generación.",
    img: FEATURE_IMG_1,
  },
  {
    icon: FileText,
    title: "Documentos PGC reales",
    desc: "Facturas, nóminas, extractos bancarios, pólizas de seguro y más — todo según el Plan General Contable español.",
    img: FEATURE_IMG_2,
  },
  {
    icon: BarChart3,
    title: "Historial y exportación",
    desc: "Guarda todas tus generaciones, revisítalas cuando quieras y exporta todo a PDF para imprimir en clase.",
    img: FEATURE_IMG_3,
  },
];

const highlights = [
  "Facturas de compra y venta con asientos",
  "Cuadro de amortización (Sistema Francés)",
  "Liquidación de póliza de crédito",
  "Nóminas con SS e IRPF",
  "Pólizas de seguros y periodificación",
  "Extractos bancarios y tarjetas",
  "Libro diario completo",
  "Siniestros y seguros (678/778)",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ContabilGen Pro" className="w-9 h-9" />
            <span className="font-bold text-lg text-slate-900">ContabilGen <span className="text-primary">Pro</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="rounded-xl font-semibold text-slate-700">Iniciar sesión</Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-xl font-semibold shadow-md px-5">Empezar gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${HERO_IMG}')` }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-blue-900/80 to-slate-900/70" />
        {/* Decorative blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-white/90 text-sm font-medium">Impulsado por IA · Plan General Contable Español</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6">
            Ejercicios contables{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              generados por IA
            </span>
          </h1>

          <p className="text-xl text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed">
            Genera universos contables completos para Grado Medio de Contabilidad. 
            Documentos reales, datos coherentes, listos para imprimir en clase.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register">
              <Button size="lg" className="rounded-2xl px-8 py-6 text-base font-bold shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 gap-2">
                Empezar gratis ahora <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="rounded-2xl px-8 py-6 text-base font-semibold bg-white/10 backdrop-blur border-white/30 text-white hover:bg-white/20 hover:text-white">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="flex flex-col items-center gap-2 text-white/40 animate-bounce">
            <span className="text-xs font-medium tracking-widest uppercase">Descubrir más</span>
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-3 gap-8 text-center text-white">
          {[
            { value: "+12", label: "Documentos por universo" },
            { value: "100%", label: "Según PGC español" },
            { value: "∞", label: "Generaciones posibles" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-extrabold mb-1">{value}</p>
              <p className="text-blue-100 text-sm font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block bg-blue-100 text-blue-700 font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
              Funcionalidades
            </span>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">
              Todo lo que necesitas para practicar contabilidad
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Diseñado específicamente para el currículo de Grado Medio de Administración y Finanzas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, desc, img }) => (
              <div key={title} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={img}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCUMENTS ───────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block bg-green-100 text-green-700 font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
                Documentos incluidos
              </span>
              <h2 className="text-4xl font-extrabold text-slate-900 mb-6 leading-tight">
                Un universo contable completo, de principio a fin
              </h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Cada generación produce un ecosistema contable coherente con empresa, proveedores, clientes 
                y todos los documentos interrelacionados — como en la vida real.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {highlights.map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=85&auto=format&fit=crop"
                  alt="Profesional de contabilidad trabajando"
                  className="w-full object-cover aspect-[4/3]"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent" />
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Libro Diario completo</p>
                  <p className="text-xs text-slate-400">Asientos contables automáticos</p>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Para educadores</p>
                  <p className="text-xs text-slate-400">FP Administración y Finanzas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-slate-900 to-blue-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=60&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <span className="inline-block bg-white/10 text-white/80 font-semibold text-sm px-4 py-1.5 rounded-full mb-4 border border-white/20">
            Cómo funciona
          </span>
          <h2 className="text-4xl font-extrabold text-white mb-12">
            Del clic al ejercicio completo en segundos
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Configura tu universo", desc: "Selecciona el sector, régimen fiscal, año contable y el nombre de la empresa." },
              { step: "02", title: "La IA genera todo", desc: "El sistema crea automáticamente todos los documentos contables interconectados y coherentes." },
              { step: "03", title: "Usa en clase", desc: "Revisa, guarda o imprime el universo completo. Genera tantos como necesites sin límite." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-colors">
                <div className="text-5xl font-black text-blue-400/40 mb-4 leading-none">{step}</div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 p-12">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
              <img src="/logo.png" alt="ContabilGen Pro" className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">
              Empieza a generar ejercicios hoy
            </h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Crea tu cuenta gratuita y genera tu primer universo contable en menos de un minuto. 
              Sin tarjeta de crédito.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="rounded-2xl px-8 py-6 text-base font-bold shadow-xl gap-2">
                  Crear cuenta gratuita <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="rounded-2xl px-8 py-6 text-base font-semibold">
                  Iniciar sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-center">
          <span className="text-slate-400 text-xs">
            Con la iniciativa del Departamento de Administración de Empresas del IES Manuel Martín González.
          </span>
          <span className="text-slate-600 text-xs hidden sm:inline">·</span>
          <span className="text-slate-400 text-xs">Creado por Atreyu Servicios Digitales</span>
          <img
            src="/asd-logo.png"
            alt="Atreyu Servicios Digitales"
            className="h-5 w-auto object-contain"
            style={{ mixBlendMode: "screen" }}
          />
        </div>
      </footer>
    </div>
  );
}
