import CrashHeatmap from "@/components/Map";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const disableMap = process.env.NEXT_PUBLIC_DISABLE_MAP === "1";
  return (
    <div className="font-sans min-h-screen p-6 sm:p-8">
      <div className="container">
        <div className="toolbar mb-4">
          <div>
            <div className="title">California Crash Heatmap</div>
            <div className="subtitle">
              Interactive density map based off data from the California Crash
              Reporting System, 2025
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="card">
          <div className="map-wrap">
            {disableMap ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Map disabled (NEXT_PUBLIC_DISABLE_MAP=1)
              </div>
            ) : (
              <CrashHeatmap />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
