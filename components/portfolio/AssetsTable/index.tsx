"use client";
import AssetsContent from "./AssetsContent";

const AssetsTable = () => {
  return (
    <div className="p-4 bg-[#1A1D1F] rounded-2xl flex-1 flex flex-col min-h-0 max-h-[505px]">
      <div className="mb-4 border-b border-border shrink-0 pb-3">
        <p className="text-xs text-primary font-medium">Assets</p>
      </div>

      <AssetsContent />
    </div>
  );
};

export default AssetsTable;
