import React, { useState } from 'react'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { FaMinus, FaPlus } from "react-icons/fa6";

const FAQCard = ({ faq }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={`w-full rounded-xl border backgroundColor transition-all duration-200 hover:shadow-md ${
                isOpen
                    ? "border-[var(--primary-color)] shadow-md"
                    : "border-[var(--border-color)] shadow-sm"
            }`}
        >
            <CollapsibleTrigger className="w-full flex justify-between gap-4 items-center p-4 sm:p-5 text-left">
                <h3 className="text-base sm:text-lg font-bold textColor">
                    {faq?.translations?.question ?? faq?.question}
                </h3>
                <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                        isOpen ? "primaryBackColor text-white" : "primaryLightBack primaryColor"
                    }`}
                >
                    {isOpen ? <FaMinus size={14} /> : <FaPlus size={14} />}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                    <div className="border-t border-[var(--border-color)] pt-3 text-sm sm:text-base leading-relaxed SecondaryTextColor">
                        {faq?.translations?.answer ?? faq?.answer}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

export default FAQCard
