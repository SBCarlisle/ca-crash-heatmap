import CrashHeatmap from "@/components/Map";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="font-sans min-h-screen p-6 sm:p-8">
      <div className="container">
        <div className="toolbar mb-4">
          <div>
            <div className="title">California Crash Heatmap</div>
            <div className="subtitle">
              Interactive density with binned counts at low zoom
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="card">
          <div className="map-wrap">
            <CrashHeatmap />
          </div>
        </div>
      </div>
    </div>
  );
}
