import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import React, { useState } from "react";
import { IoMdArrowDropdown } from "react-icons/io";
import { IoMdArrowDropup } from "react-icons/io";

const SubscriptionFaqCard = ({ faq }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full p-2 rounded-md border  mb-2 mx-3"
    >
      <CollapsibleTrigger
        className={`w-full flex justify-between gap-3 items-center p-2 font-bold`}
      >
        <div>
          <h3 className="text-lg font-bold text-left md:text-center overflow-hidden">
            {faq?.question}
          </h3>
        </div>
        <div className="flex items-center">
          {isOpen ? (
            <div className=" inline-flex items-center justify-center">
              <IoMdArrowDropup size={24} />
            </div>
          ) : (
            <div className=" inline-flex items-center justify-center">
              <IoMdArrowDropdown size={24} />
            </div>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={`p-3 ${isOpen ? "border-t border-[var(--border-color)] mt-2 textColor " : ""
          }`}
      >
        {faq?.answer}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SubscriptionFaqCard;
