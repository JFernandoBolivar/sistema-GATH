import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  className,
  errorMessage,
}: {
  className?: string;
  errorMessage?: string;
}) {
  return (
    <>
      <Card className={cn(className)}>
        <CardContent>
          <div className="relative w-60 h-60 m-auto flex items-center justify-center">
            <div className="absolute inset-2 rounded-full border-b-2 border-red-500 animate-spin"></div>

            <div
              className="absolute inset-7 rounded-full border-t-2 border-orange-500 animate-spin"
              style={{
                animationDirection: "reverse",
                animationDuration: "0.8s",
              }}
            ></div>

            <div className="relative z-10 animate-float-error">
              <div className="w-24 h-24 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center animate-pulse-red">
                <div className="text-4xl font-bold text-red-600 animate-shake">
                  !
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 text-lg text-red-600 animate-pulse text-center font-semibold">
              {errorMessage ? errorMessage : "Algo salió mal"}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
