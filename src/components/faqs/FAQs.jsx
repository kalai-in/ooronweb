import React, { useCallback, useEffect, useState } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import * as api from "../../api/apiRoutes";
import FAQCard from "./FAQCard";
import { t } from "@/utils/translation";
import CardSkeleton from "../skeleton/CardSkeleton";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import NoSearchImage from "@/assets/empty-state/no-search.svg";

const FAQs = () => {
  const [faqs, setFaqs] = useState([]);
  const total_faqs_per_page = 7;
  const [currPage, setcurrPage] = useState(1);
  const [offset, setoffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalFaqs, setTotalFaqs] = useState(0);

  const handleFetchFAQs = useCallback(
    async (offset = 0) => {
      setIsLoading(true);
      try {
        const response = await api.getFAQs({
          limit: total_faqs_per_page,
          offset,
        });
        setFaqs([...faqs, ...response?.data]);
        setTotalFaqs(response?.total);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        console.log("FAQs page error: ", error);
      }
    },
    [faqs],
  );

  useEffect(() => {
    handleFetchFAQs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handlePageChange = (pageNum) => {
    setcurrPage(pageNum);
    setoffset(pageNum * total_faqs_per_page - total_faqs_per_page);
    handleFetchFAQs(pageNum * total_faqs_per_page - total_faqs_per_page);
  };
  return (
    <section>
      <div>
        <BreadCrumb />
      </div>
      <div className="container my-4 flex flex-col items-center gap-4 bodyBackgroundColor px-4 md:px-0">
        {faqs?.length > 0
          ? faqs.map((faq, idx) => <FAQCard key={idx} faq={faq} />)
          : !isLoading && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center w-full">
                <ThemedSvg
                  src={NoSearchImage}
                  alt={t("no_faqs_available") || "No FAQs available"}
                  className="w-44 max-w-[240px]"
                />
                <span className="text-2xl md:text-3xl font-semibold text-zinc-700 dark:text-zinc-200">
                  {t("no_faqs_available") || "No FAQs available."}
                </span>
                <p className="max-w-2xl text-base md:text-lg text-zinc-500 dark:text-zinc-400 px-4 md:px-0">
                  {t("no_faqs_found_description") ||
                    "There are no FAQs to display right now."}
                </p>
              </div>
            )}
        {isLoading &&
          Array.from({ length: total_faqs_per_page }).map((_, idx) => (
            <div key={idx} className="w-full">
              <CardSkeleton height={40} padding="p-1" />
            </div>
          ))}
        {totalFaqs > faqs?.length && (
          <button
            className="px-3 py-[6px] h-full flex items-center rounded font-medium text-whiterounded  focus:outline-none bg-[#29363f] text-white text-xl shadow"
            onClick={() => handlePageChange(currPage + 1)}
          >
            {t("load_more")}
          </button>
        )}
      </div>
    </section>
  );
};

export default FAQs;
