import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import moment from "moment";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  align?: "center" | "start" | "end";
  className?: string;
  showTime?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onDateRangeChange,
  align = "center",
  className,
  showTime = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;

    const range = { ...dateRange };
    if (!range.from) {
      range.from = date;
    } else if (!range.to && date > range.from) {
      range.to = date;
    } else {
      range.from = date;
      range.to = undefined;
    }

    onDateRangeChange(range);
    if (range.from && range.to) {
      setIsOpen(false);
    }
  };

  // Format the date range for display
  const formatDateRange = () => {
    if (!dateRange.from) return "Select date range";
    
    const fromText = moment(dateRange.from).format("MMM D, YYYY");
    
    if (!dateRange.to) return `${fromText} - ?`;
    
    const toText = moment(dateRange.to).format("MMM D, YYYY");
    return `${fromText} - ${toText}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !dateRange.from && "text-muted-foreground", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          defaultMonth={dateRange.from}
          selected={{
            from: dateRange.from,
            to: dateRange.to,
          }}
          onSelect={(range) => {
            onDateRangeChange({
              from: range?.from,
              to: range?.to,
            });
          }}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};