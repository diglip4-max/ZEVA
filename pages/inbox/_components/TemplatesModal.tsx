import { useState, useEffect, FC, SetStateAction } from "react";
import { toast } from "react-toastify";
import {
  NotepadText,
  Search,
  X,
  Check,
  Upload,
  FileText,
  Braces,
} from "lucide-react";
import { capitalize, handleError } from "@/lib/helper";
import { Template } from "@/types/templates";
import axios from "axios";
import { Provider } from "@/types/conversations";
import { VariableType } from "@/hooks/useInbox";

interface IProps {
  attachedFile: File | null;
  templates: Template[];
  selectedTemplate: Template | null;
  selectedProvider: Provider | null;
  setMessage: React.Dispatch<SetStateAction<string>>;
  setMediaType: React.Dispatch<
    SetStateAction<"" | "image" | "video" | "audio" | "document">
  >;
  setAttachedFile: React.Dispatch<SetStateAction<File | null>>;
  setBodyParameters: React.Dispatch<SetStateAction<VariableType[]>>;
  setHeaderParameters: React.Dispatch<SetStateAction<VariableType[]>>;
  //   setTemplates: React.Dispatch<SetStateAction<Template[]>>;
  setSelectedTemplate: React.Dispatch<SetStateAction<Template | null>>;
}

const TemplatesModal: FC<IProps> = ({
  attachedFile,
  templates,
  selectedTemplate,
  selectedProvider,
  setMessage,
  setAttachedFile,
  setMediaType,
  setBodyParameters,
  setHeaderParameters,
  //   setTemplates,
  setSelectedTemplate,
}) => {
  const isBusinessHour = true;

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] =
    useState<boolean>(false);
  const [tempVariables, setTempVariables] = useState<Record<string, string>>(
    {}
  );
  const [tempHeaderVariables, setTempHeaderVariables] = useState<
    Record<string, string>
  >({});
  const [searchInput, setSearchInput] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  const handleTempVarValueChange = (
    key: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setTempVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTempHeaderVarValueChange = (
    key: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setTempHeaderVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFillHeaderVariables = (
    headerText: string,
    message: string,
    headerVariables: Record<string, string>
  ) => {
    let updatedHeader = headerText;
    let updatedMessage = message;
    let headerParams: VariableType[] = [];

    Object.entries(headerVariables).forEach(([key, value]) => {
      const extractedKey = key.match(/{{\d+}}/)?.[0];

      if (extractedKey && updatedHeader.includes(extractedKey)) {
        updatedHeader = updatedHeader.replaceAll(extractedKey, value);
        headerParams.push({ type: "text", text: value });
      }
    });

    updatedMessage = `${updatedHeader}\n${updatedMessage}`.trim();
    return { updatedMessage, headerParams };
  };

  const handleFillMessageVariables = (
    message: string,
    variables: Record<string, string>
  ) => {
    let newMessage = message;
    let bodyVariables: VariableType[] = [];

    Object.entries(variables).forEach(([key, value]) => {
      const extractedKey = key.replace(
        /\[?"?({{\d+}})"?\]?/g,
        (_match, p1) => p1
      );

      if (newMessage?.includes(extractedKey)) {
        newMessage = newMessage.replaceAll(extractedKey, value);
        bodyVariables.push({ type: "text", text: value });
      }
    });

    return { updatedMessage: newMessage, bodyVariables };
  };

  const handleSelectTemplate = (temp: Template) => {
    setSelectedTemplate(temp);
    setTempVariables({});
    setTempHeaderVariables({});
    setIsDropdownOpen(false);
    setIsTemplateSheetOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    let newMessage = selectedTemplate?.content;
    let headerParams: VariableType[] = [];
    let headerText = selectedTemplate?.headerText;

    if (headerText) {
      const headerData = handleFillHeaderVariables(
        headerText,
        selectedTemplate.content,
        tempHeaderVariables
      );
      newMessage = headerData.updatedMessage;
      headerParams = headerData?.headerParams;
    }

    const { updatedMessage, bodyVariables } = handleFillMessageVariables(
      newMessage,
      tempVariables
    );

    setHeaderParameters(headerParams);
    setBodyParameters(bodyVariables);
    setMessage(updatedMessage);
    setIsTemplateSheetOpen(false);
  };

  useEffect(() => {
    const fetchAllTemplates = async () => {
      try {
        const { data } = await axios.get(
          `/api/all-templates?limit=1000&search=${searchInput}`,
          {
            headers: {
              Authorization: `Bearer ${token}`, //apiKey
            },
          }
        );
        if (data && data.success) {
          //   dispatch(setTemplates(data.data));
        }
      } catch (error) {
        handleError(error);
      }
    };
    fetchAllTemplates();
  }, [searchInput]);

  const filteredTemplates = templates?.filter((item: Template) => {
    const typeMatch = selectedProvider?.type?.includes(item.templateType);
    const statusMatch = item?.status === "approved";
    const providerMatch =
      item?.templateType !== "whatsapp" ||
      item?.provider?._id === selectedProvider?._id;
    return typeMatch && statusMatch && providerMatch;
  });

  const disableSaveTempBtn = () => {
    if (!selectedTemplate) return false;

    // Check body variables
    const bodyFilled =
      selectedTemplate?.variables?.every((variable: string) =>
        tempVariables[variable]?.trim()
      ) ?? true;

    // Check header variables
    const headerFilled =
      selectedTemplate?.headerVariables?.every((variable: string) =>
        tempHeaderVariables[variable]?.trim()
      ) ?? true;

    // Check file upload if needed
    const fileValid = !(
      selectedTemplate?.isHeader &&
      selectedTemplate?.headerType !== "text" &&
      !attachedFile
    );

    return bodyFilled && headerFilled && fileValid;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const fileType = selectedFile.type;
      const fileSize = selectedFile.size;

      const maxSize = fileType.startsWith("image/")
        ? 5 * 1024 * 1024
        : fileType.startsWith("video/")
        ? 16 * 1024 * 1024
        : 100 * 1024 * 1024;

      if (fileSize > maxSize) {
        toast.warning(
          `File size exceeds the limit of ${maxSize / (1024 * 1024)}MB`
        );
        e.target.value = "";
        return;
      }

      const type = selectedFile.type;
      if (type.startsWith("image/")) {
        setMediaType("image");
      } else if (type.startsWith("video/")) {
        setMediaType("video");
      } else if (type === "application/pdf") {
        setMediaType("document");
      }

      setAttachedFile(selectedFile);
    }
  };

  const renderVariableInput = (
    key: string,
    index: number,
    isHeader: boolean = false
  ) => (
    <div key={index} className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {isHeader ? "Header" : "Body"} variable {"{{"}
        {index + 1}
        {"}}"}:
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              value={
                isHeader
                  ? tempHeaderVariables[key] || ""
                  : tempVariables[key] || ""
              }
              onChange={(event) =>
                isHeader
                  ? handleTempHeaderVarValueChange(key, event)
                  : handleTempVarValueChange(key, event)
              }
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder={`Enter value for {{${index + 1}}}`}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-md">
                {`{ {${index + 1} }}`}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
        >
          <Braces className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Template Selector Button */}
      <div className="relative">
        <button
          title="Choose Template"
          disabled={!isBusinessHour}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
            flex items-center cursor-pointer gap-1.5 p-2.5 rounded-lg border transition-all duration-200
            ${
              !isBusinessHour
                ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                : "bg-white border-gray-300 hover:border-gray-400 hover:shadow-sm text-gray-700"
            }
          `}
        >
          <NotepadText className="w-5 h-5" />
        </button>

        {/* Templates Modal (centered) */}
        {isDropdownOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop (blurred) */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* Centered Modal */}
            <div className="relative min-h-full flex items-center justify-center p-4">
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 text-lg">
                      Templates
                    </h3>
                    <button
                      onClick={() => setIsDropdownOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search templates..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Template List */}
                <div className="p-2 overflow-y-auto max-h-[calc(90vh-140px)]">
                  {filteredTemplates?.length === 0 ? (
                    <div className="p-8 text-center">
                      <NotepadText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        No templates found
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Create templates in your dashboard
                      </p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {filteredTemplates?.map((item: Template) => (
                        <div
                          key={item._id}
                          onClick={() => handleSelectTemplate(item)}
                          className={`
                            p-3 mb-2 rounded-lg border cursor-pointer transition-all duration-200
                            ${
                              selectedTemplate?._id === item._id
                                ? "bg-blue-50 border-blue-200"
                                : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-800 text-sm">
                                {item.name}
                              </h4>
                              <p className="text-xs text-gray-500 truncate mt-1">
                                {item.content?.substring(0, 40)}
                                {item.content?.length > 40 ? "..." : ""}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium
                                  ${
                                    item.templateType === "sms"
                                      ? "bg-blue-100 text-blue-700"
                                      : item.templateType === "whatsapp"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-purple-100 text-purple-700"
                                  }
                                `}
                                >
                                  {capitalize(item.templateType)}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                  {item.language}
                                </span>
                              </div>
                            </div>
                            {selectedTemplate?._id === item._id && (
                              <Check className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Details Sheet */}
      {isTemplateSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsTemplateSheetOpen(false)}
          />

          {/* Sheet */}
          <div className="relative min-h-full flex items-end justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Template Details
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Fill in template variables
                    </p>
                  </div>
                  <button
                    onClick={() => setIsTemplateSheetOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Template Info Card */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-white rounded-lg border border-blue-200 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {selectedTemplate?.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${
                                selectedTemplate?.templateType === "sms"
                                  ? "bg-blue-100 text-blue-700"
                                  : selectedTemplate?.templateType ===
                                    "whatsapp"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-purple-100 text-purple-700"
                              }
                            `}
                            >
                              {capitalize(selectedTemplate?.templateType || "")}
                            </span>
                            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                              {selectedTemplate?.category || "General"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Check className="w-3 h-3 mr-1" />
                        Approved
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Section */}
                {selectedTemplate?.headerType === "text" &&
                  selectedTemplate?.headerText && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Header
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-sm text-gray-800">
                          {selectedTemplate?.headerText}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Header Variables */}
                {selectedTemplate?.headerVariables?.map(
                  (key: string, index: number) =>
                    renderVariableInput(key, index, true)
                )}

                {/* Body Section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Message Body
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                      {selectedTemplate?.content}
                    </pre>
                  </div>
                </div>

                {/* Body Variables */}
                {selectedTemplate &&
                  selectedTemplate?.variables?.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h4 className="text-sm font-semibold text-gray-700">
                        Fill Variables
                      </h4>
                      {selectedTemplate?.variables?.map(
                        (key: string, index: number) =>
                          renderVariableInput(key, index, false)
                      )}
                    </div>
                  )}

                {/* File Upload for Media Headers */}
                {selectedTemplate?.isHeader &&
                  selectedTemplate?.headerType !== "text" && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Upload {capitalize(selectedTemplate?.headerType)}
                      </h4>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Upload className="w-8 h-8 text-gray-500" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Drop your file here or click to browse
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            Supports{" "}
                            {selectedTemplate?.headerType === "image"
                              ? "JPG, PNG up to 5MB"
                              : selectedTemplate?.headerType === "video"
                              ? "MP4, 3GP up to 16MB"
                              : "PDF, DOC, PPT up to 100MB"}
                          </p>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              onChange={handleFileChange}
                              accept={
                                selectedTemplate?.headerType === "image"
                                  ? "image/jpeg,image/jpg,image/png"
                                  : selectedTemplate?.headerType === "video"
                                  ? "video/mp4,video/3gp"
                                  : ".pdf,.doc,.docx,.pptx,.xlsx"
                              }
                            />
                            <span className="px-6 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all inline-flex items-center gap-2">
                              Browse Files
                            </span>
                          </label>
                          {attachedFile && (
                            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FileText className="w-5 h-5 text-green-600" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">
                                      {attachedFile.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {(
                                        attachedFile.size /
                                        1024 /
                                        1024
                                      ).toFixed(2)}{" "}
                                      MB
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setAttachedFile(null)}
                                  className="p-1 hover:bg-red-50 rounded-full"
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setIsTemplateSheetOpen(false);
                    }}
                    className="px-5 py-2.5 cursor-pointer border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!disableSaveTempBtn()}
                    onClick={handleSaveTemplate}
                    className={`
                      px-6 py-2.5 cursor-pointer font-medium rounded-lg transition-all
                      ${
                        disableSaveTempBtn()
                          ? "bg-gradient-to-r from-gray-700 to-gray-800 text-white hover:from-gray-800 hover:to-gray-900 shadow-md"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }
                    `}
                  >
                    Apply Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Field Mapping Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Insert Field
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Customer Name", value: "{customer_name}" },
                    { label: "Order Number", value: "{order_number}" },
                    { label: "Date", value: "{date}" },
                    { label: "Time", value: "{time}" },
                    { label: "Amount", value: "{amount}" },
                    { label: "Reference ID", value: "{reference_id}" },
                  ].map((field) => (
                    <button
                      key={field.value}
                      onClick={() => {
                        // Handle field insertion logic here
                        setIsModalOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {field.label}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {field.value}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TemplatesModal;
