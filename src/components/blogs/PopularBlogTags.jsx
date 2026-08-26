import { t } from "@/utils/translation";

const PopularBlogTags = ({ tags, setSelectedTag, selectedTag }) => {

  const handleTagClick = (tagId) => {
    if (tagId == selectedTag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tagId);
    }
  };

  return (
    <div className="w-full p-4 gap-6 border rounded-lg backgroundColor">
      <h2 className="text-xl font-bold underline underline-offset-4 mb-4">
        {t("popular_tags")}
      </h2>

      <div className="flex flex-wrap gap-4">
        {tags.map((tag) => (
          <button
          type="button"
            onClick={() => handleTagClick(tag?.id)}
            key={tag.id}
            className={`${tag?.id == selectedTag
              ? "primaryBackColor text-white"
              : "bodyBackgroundColor textColor"
              }   px-5 py-2 rounded-full  font-medium text-base max-w-[280px] md:max-w-[290px] lg:max-w-[280px] xl:max-w-[380px] whitespace-normal break-words text-center`}
          >
            {tag?.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PopularBlogTags;
