import React, { useState, useEffect, useRef } from "react";
import { NextPageWithLayout } from "@/pages/_app";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { ReactElement } from "react";
import { useRouter } from "next/router";
import { toast } from "react-hot-toast";
import { Save, ArrowLeft, Loader2, Layout, FileText } from "lucide-react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import EmailEditor, { EditorRef, EmailEditorProps } from "react-email-editor";
import Loader from "@/components/Loader";
import VariableMappingDropdown from "../../automation/_components/VariableMappingDropdown";

const BlockEditorPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { templateId, campaignId } = router.query;
  const token = getTokenByPath();
  const editorRef = useRef<EditorRef>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveTemplateLoading, setSaveTemplateLoading] =
    useState<boolean>(false);
  const [design, setDesign] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!templateId) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await axios.get(`/api/all-templates/${templateId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data?.success) {
          if (data?.template?.designJson) {
            setDesign(data.template.designJson);
          } else if (data?.template?.content) {
            // If there's no designJson but there's content, we might not be able to load it into block editor
            // unless it was originally saved from the block editor.
            console.warn(
              "Template has content but no designJson. Block editor might not be able to load it.",
            );
          }
        }
      } catch (error: any) {
        console.error("Error fetching template:", error?.message);
        toast.error(
          error?.response?.data?.message || "Failed to load template",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [templateId, token]);

  const onReady: EmailEditorProps["onReady"] = (unlayer) => {
    if (design) {
      try {
        unlayer.loadDesign(design);
      } catch (error) {
        console.error("Failed to load design:", error);
        toast.error("Error loading template content.");
      }
    }
  };

  const handleSaveDesign = () => {
    if (!campaignId) return;
    const unlayer = editorRef.current?.editor;

    unlayer?.exportHtml(async (data) => {
      const { design, html } = data;
      try {
        setSaveLoading(true);
        console.log({ p: `/api/campaigns/${campaignId}` });
        const { data: response } = await axios.put(
          `/api/campaigns/${campaignId}`,
          {
            content: html,
            designJson: design,
            editorType: "block-editor",
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response?.success) {
          toast.success("Saved successfully");
          if (templateId) {
            router.push(`/clinic/all-templates/${templateId}`);
          } else if (campaignId) {
            router.push(`/clinic/campaigns/${campaignId}/edit`);
          } else {
            router.back();
          }
        }
      } catch (error: any) {
        console.error("Error updating campaign:", error?.message);
        toast.error(error?.response?.data?.message || error?.message);
      } finally {
        setSaveLoading(false);
      }
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!templateId) return;
    const unlayer = editorRef.current?.editor;
    if (!unlayer) {
      toast.error("Editor not available");
      return;
    }

    unlayer.exportHtml(async (data) => {
      const { design, html } = data;
      try {
        setSaveTemplateLoading(true);
        const { data: response } = await axios.put(
          `/api/all-templates/edit-template/${templateId}`,
          {
            content: html,
            designJson: design,
            editorType: "block-editor",
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response?.success) {
          toast.success(response.message || "Template saved successfully!");
          router.push(`/clinic/all-templates/${templateId}`);
        }
      } catch (error: any) {
        console.error("Error saving template:", error?.message);
        toast.error(error?.response?.data?.message || error?.message);
      } finally {
        setSaveTemplateLoading(false);
      }
    });
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layout className="w-5 h-5 text-purple-600" />
              Block Editor
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Design professional emails with drag & drop
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <VariableMappingDropdown
            onSelect={(variable) => {
              // Copy to clipboard or provide a way to insert
              navigator.clipboard.writeText(variable);
              toast.success(`Copied ${variable} to clipboard`);
            }}
            align="right"
            nodeId=""
          />

          {campaignId && (
            <button
              onClick={handleSaveDesign}
              disabled={saveLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
            >
              {saveLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save & Quit
            </button>
          )}

          {templateId && (
            <button
              onClick={handleSaveAsTemplate}
              disabled={saveTemplateLoading}
              className="flex items-center gap-2 px-4 py-2 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {saveTemplateLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Save as Template
            </button>
          )}
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <EmailEditor
          ref={editorRef}
          onReady={onReady}
          style={{ height: "calc(100vh - 64px)" }}
          options={{
            appearance: {
              theme: "light",
              panels: {
                tools: {
                  dock: "left",
                },
              },
            },
            features: {
              smartMergeTags: true,
              undoRedo: true,
            },
            tools: {
              social: { enabled: true },
              video: { enabled: true },
              image: { enabled: true },
              button: { enabled: true },
              text: { enabled: true },
              divider: { enabled: true },
              html: { enabled: true },
            },
          }}
        />
      </div>
    </div>
  );
};

// Layout configuration
BlockEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={true} hideHeader={true}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedBlockEditorPage = withClinicAuth(
  BlockEditorPage,
) as NextPageWithLayout;
ProtectedBlockEditorPage.getLayout = BlockEditorPage.getLayout;

export default ProtectedBlockEditorPage;
