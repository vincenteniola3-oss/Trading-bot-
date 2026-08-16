import React, { useState, useEffect } from "react";
import { FileCode2, Save, Play, Folder, Check, RotateCw, AlertCircle } from "lucide-react";
import { FileNode } from "../types";

interface CodeExplorerProps {
  onRunTests: () => void;
  isTesting: boolean;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({ onRunTests, isTesting }) => {
  const [fileList, setFileList] = useState<FileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("bot/strategy.py");
  const [fileContent, setFileContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch file list
  useEffect(() => {
    fetch("/api/files/list")
      .then((res) => res.json())
      .then((data) => {
        if (data.files) setFileList(data.files);
      })
      .catch((err) => console.error("Error fetching file list:", err));
  }, []);

  // Fetch content of selected file
  useEffect(() => {
    if (!selectedFilePath) return;
    fetch(`/api/files/content?path=${encodeURIComponent(selectedFilePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.content !== undefined) {
          setFileContent(data.content);
          setErrorMsg(null);
        }
      })
      .catch((err) => setErrorMsg("Failed to load file content."));
  }, [selectedFilePath]);

  const handleSave = () => {
    setIsSaving(true);
    setSaveSuccess(false);
    fetch("/api/files/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selectedFilePath, content: fileContent }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsSaving(false);
        if (data.success) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } else {
          setErrorMsg(data.error || "Save failed.");
        }
      })
      .catch((err) => {
        setIsSaving(false);
        setErrorMsg(err.message);
      });
  };

  const renderFileTree = (nodes: FileNode[]) => {
    return (
      <div className="space-y-0.5 text-xs">
        {nodes.map((node) => {
          if (node.type === "directory") {
            return (
              <div key={node.path} className="space-y-0.5">
                <div className="flex items-center space-x-1.5 px-2 py-1 text-slate-400 font-semibold">
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>{node.name}</span>
                </div>
                <div className="pl-3 border-l border-slate-800 ml-2">
                  {node.children && renderFileTree(node.children)}
                </div>
              </div>
            );
          }
          const isSelected = selectedFilePath === node.path;
          return (
            <button
              key={node.path}
              onClick={() => setSelectedFilePath(node.path)}
              className={`w-full flex items-center space-x-1.5 px-2 py-1 rounded text-left transition font-mono ${
                isSelected
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{node.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[550px]">
      {/* File Tree Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 p-4 bg-slate-950/40">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
            <Folder className="w-4 h-4 text-emerald-400" />
            <span>Python Architecture</span>
          </h3>
        </div>
        {fileList.length > 0 ? (
          renderFileTree(fileList)
        ) : (
          <div className="text-xs text-slate-500 font-mono">Loading codebase files...</div>
        )}
      </div>

      {/* Editor & Actions Pane */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {/* Editor Toolbar */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2 font-mono text-xs text-slate-300">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-100">{selectedFilePath}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRunTests}
              disabled={isTesting}
              className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-emerald-400" : ""}`} />
              <span>Execute Unit Tests</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow transition"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-slate-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Textarea */}
        <div className="flex-1 p-3 bg-slate-950 relative">
          {errorMsg && (
            <div className="mb-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            className="w-full h-full min-h-[450px] bg-transparent text-slate-200 font-mono text-xs leading-relaxed focus:outline-none resize-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};
