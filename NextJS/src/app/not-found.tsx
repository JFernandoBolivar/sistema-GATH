"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Home } from "lucide-react";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [isVisible, setIsVisible] = useState(false);
  const [typedText, setTypedText] = useState("");
  const fullText = "Estamos trabajando en ello";

  useEffect(() => {
    setIsVisible(true);

    // Efecto de escritura para el texto principal
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);

    return () => clearInterval(typingInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Partículas animadas de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/10 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      <Card
        className={`w-full max-w-3xl mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur-sm overflow-hidden transform transition-all duration-1000 ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-10 opacity-0 scale-95"
        }`}
      >
        {/* Header con logo animado */}
        <div className="bg-blue-900 p-4 flex justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
          <div className="transform hover:scale-110 transition-transform duration-500 hover:rotate-3">
            <Image
              src="/images/image.png"
              width={300} // Correcto: Ancho fijo
              height={300} // Correcto: Alto fijo
              alt="Logo Reportes"
              className="object-contain" // Mantiene la proporción dentro de los 300x150
              priority // Agrega esto para que cargue rápido en reportes
            />
          </div>
        </div>

        <CardContent className="p-8 text-center space-y-6">
          {/* Mensaje principal con animaciones */}
          <div className="space-y-3">
            <h1
              className={`text-4xl font-bold text-blue-900 transform transition-all duration-1000 delay-300 ${
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-5 opacity-0"
              }`}
            >
              Página no encontrada
            </h1>

            {/* Línea animada con colores de la bandera */}
            <div className="h-1 w-32 bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 mx-auto my-4 animate-gradient-x"></div>

            <p
              className={`text-xl text-blue-800 font-medium min-h-[28px] transform transition-all duration-1000 delay-500 ${
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-5 opacity-0"
              }`}
            >
              {typedText}
              <span className="animate-pulse">|</span>
            </p>

            <p
              className={`text-gray-600 text-sm leading-relaxed max-w-lg mx-auto transform transition-all duration-1000 delay-700 ${
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-5 opacity-0"
              }`}
            >
              La página que está buscando no se encuentra disponible en este
              momento. Nuestro equipo técnico está trabajando para mejorar su
              experiencia.
            </p>
          </div>

          {/* Imagen del edificio con efectos mejorados */}
          <div
            className={`relative h-48 md:h-64 w-full overflow-hidden rounded-lg shadow-md my-6 group transform transition-all duration-1000 delay-1000 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            {/* <Image
              width={300}
              height={150}
              src="/image.png"
              alt="Edificio del Ministerio"
              fill
              style={{ objectFit: "cover" }}
              className="group-hover:scale-110 transition-transform duration-700 ease-out"
            /> */}
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/70 to-transparent group-hover:from-blue-900/50 transition-all duration-500"></div>
            <div className="absolute bottom-4 left-4 text-white text-sm font-medium transform group-hover:translate-x-2 transition-transform duration-300">
              Sede Principal
            </div>

            {/* Efecto de brillo que pasa ocasionalmente */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
          </div>

          {/* Botones de acción con animaciones mejoradas */}
          <div
            className={`flex flex-col sm:flex-row gap-3 pt-4 max-w-md mx-auto transform transition-all duration-1000 delay-1200 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-5 opacity-0"
            }`}
          >
            <Button
              asChild
              className="bg-blue-800 hover:bg-blue-900 text-white flex-1 transform hover:scale-105 hover:-translate-y-1 transition-all duration-200 hover:shadow-lg"
            >
              <Link href="/">
                <Home className="w-4 h-4 mr-2 animate-bounce" />
                Ir al inicio
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="border-blue-200 text-blue-800 hover:bg-blue-50 flex-1 transform hover:scale-105 hover:-translate-y-1 transition-all duration-200 hover:shadow-lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
              Volver atrás
            </Button>
          </div>

          {/* Pie de página con animación */}
          <div
            className={`pt-6 text-xs text-gray-500 border-t border-gray-200 mt-6 transform transition-all duration-1000 delay-1400 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-5 opacity-0"
            }`}
          >
            © {new Date().getFullYear()} Ministerio del Poder Popular para
            Relaciones Interiores, Justicia y Paz
          </div>
        </CardContent>
      </Card>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes gradient-x {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-float {
          animation: float linear infinite;
        }

        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }

        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
