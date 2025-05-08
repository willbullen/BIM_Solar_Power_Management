import { PowerData } from "@shared/schema";

type LoadDistributionProps = {
  data: PowerData | null;
  className?: string;
};

export function LoadDistribution({ data: powerData, className }: LoadDistributionProps) {
  if (!powerData) {
    return (
      <div className="bg-card rounded-lg shadow p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">No power data available</p>
      </div>
    );
  }
  
  // Calculate total and percentages
  const totalUsage = powerData.totalLoad;
  const shedsColdRooms = powerData.bigColdRoom;
  const bigColdRoom = shedsColdRooms * 0.7; // Example distribution
  const bigFreezer = powerData.bigFreezer;
  const smoker = powerData.smoker;
  const unaccounted = powerData.unaccountedLoad;
  
  // Calculate percentages
  const shedsColdRoomsPercent = (shedsColdRooms / totalUsage) * 100;
  const bigColdRoomPercent = (bigColdRoom / totalUsage) * 100;
  const bigFreezerPercent = (bigFreezer / totalUsage) * 100;
  const smokerPercent = (smoker / totalUsage) * 100;
  const unaccountedPercent = (unaccounted / totalUsage) * 100;
  
  // Calculate daily values (assuming current power × 24 hours)
  const shedsColdRoomsDaily = shedsColdRooms * 24;
  const bigColdRoomDaily = bigColdRoom * 24;
  const bigFreezerDaily = bigFreezer * 24;
  const smokerDaily = smoker * 24;
  const unaccountedDaily = unaccounted * 24;
  
  return (
    <div className="bg-card rounded-lg shadow">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-medium text-white">Load Distribution</h3>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Consumer</th>
                <th className="text-right">Power (kW)</th>
                <th className="text-right">Usage (%)</th>
                <th className="text-right">Daily (kWh)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-white">Total Usage</td>
                <td className="text-right text-white">{totalUsage.toFixed(2)}</td>
                <td className="text-right text-white">100%</td>
                <td className="text-right text-white">-</td>
              </tr>
              <tr>
                <td className="text-white">Sheds & Cold Rooms</td>
                <td className="text-right text-white">{shedsColdRooms.toFixed(2)}</td>
                <td className="text-right text-white">{shedsColdRoomsPercent.toFixed(0)}%</td>
                <td className="text-right text-white">{shedsColdRoomsDaily.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="text-white">Big Cold Room</td>
                <td className="text-right text-white">{bigColdRoom.toFixed(2)}</td>
                <td className="text-right text-white">{bigColdRoomPercent.toFixed(0)}%</td>
                <td className="text-right text-white">{bigColdRoomDaily.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="text-white">Big Freezer</td>
                <td className="text-right text-white">{bigFreezer.toFixed(2)}</td>
                <td className="text-right text-white">{bigFreezerPercent.toFixed(0)}%</td>
                <td className="text-right text-white">{bigFreezerDaily.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="text-white">Smoker</td>
                <td className="text-right text-white">{smoker.toFixed(2)}</td>
                <td className="text-right text-white">{smokerPercent.toFixed(0)}%</td>
                <td className="text-right text-white">{smokerDaily.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="text-white">Balance (Unaccounted)</td>
                <td className="text-right text-white">{unaccounted.toFixed(2)}</td>
                <td className="text-right text-white">{unaccountedPercent.toFixed(0)}%</td>
                <td className="text-right text-white">{unaccountedDaily.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
