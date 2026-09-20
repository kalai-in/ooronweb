import React from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import { useSelector } from "react-redux";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

const ContactUs = () => {
  const setting = useSelector((state: any) => state?.Setting?.setting);
  return (
    <section>
      <div>
        <BreadCrumb />
      </div>
      {setting?.contact_us && (
        <div className="container my-5 bodyBackgroundColor px-1 md:px-0">
          <div
            className="flex flex-col gap-4 rounded p-4 items-center backgroundColor infoContent"
            dangerouslySetInnerHTML={sanitizeHtml(setting?.contact_us)}
          />
        </div>
      )}
    </section>
  );
};

export default ContactUs;
