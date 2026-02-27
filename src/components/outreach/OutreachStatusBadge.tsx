type OutreachStatus =
  | "not-contacted"
  | "contacted"
  | "responded"
  | "meeting-scheduled"
  | "proposal-sent"
  | "won"
  | "lost";

interface OutreachStatusBadgeProps {
  status: OutreachStatus;
}

const getStatusConfig = (status: OutreachStatus) => {
  switch (status) {
    case "not-contacted":
      return {
        label: "Not Contacted",
        className: "bg-gray-100 text-gray-700 border-gray-200",
      };
    case "contacted":
      return {
        label: "Contacted",
        className: "bg-blue-100 text-blue-700 border-blue-200",
      };
    case "responded":
      return {
        label: "Responded",
        className: "bg-green-100 text-green-700 border-green-200",
      };
    case "meeting-scheduled":
      return {
        label: "Meeting Scheduled",
        className: "bg-purple-100 text-purple-700 border-purple-200",
      };
    case "proposal-sent":
      return {
        label: "Proposal Sent",
        className: "bg-orange-100 text-orange-700 border-orange-200",
      };
    case "won":
      return {
        label: "Won",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    case "lost":
      return {
        label: "Lost",
        className: "bg-red-100 text-red-700 border-red-200",
      };
    default:
      return {
        label: "Unknown",
        className: "bg-gray-100 text-gray-700 border-gray-200",
      };
  }
};

export default function OutreachStatusBadge({ status }: OutreachStatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// Export the type for use in other components
export type { OutreachStatus };
