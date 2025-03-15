"use client";
import { useState } from "react";
import JSZip from "jszip";
import FileSaver from "file-saver";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// =============================
// Main Component
// =============================
export default function DocxProcessor({ data }: { data: Record<string, any> }) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setProcessing(true);
    setProgress(10);
    setError("");

    try {
      await processDocxTemplate(file, data);
      setProgress(100);
      toast({
        title: "Success",
        description: "Document processed successfully!",
      });
    } catch (error: any) {
      console.error("Error processing document:", error);
      setError(`Error: ${error?.message || "Failed to process document"}`);
    } finally {
      setTimeout(() => setProcessing(false), 1000);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <FileUploadInput onFileChange={handleFileUpload} />
      {processing && (
        <ProgressSection fileName={fileName} progress={progress} />
      )}
      {error && <ErrorSection message={error} />}
    </div>
  );
}

// =============================
// Helper UI Components
// =============================
const FileUploadInput = ({
  onFileChange,
}: {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors">
    <input
      type="file"
      accept=".docx"
      onChange={onFileChange}
      className="hidden"
      id="docx-upload"
    />
    <label
      htmlFor="docx-upload"
      className="flex flex-col items-center justify-center cursor-pointer"
    >
      <UploadIcon />
      <span className="text-lg font-medium mb-1">Upload DOCX Template</span>
      <span className="text-sm text-gray-500">
        Drop your file here or click to browse
      </span>
    </label>
  </div>
);

const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-12 w-12 text-gray-400 mb-3"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
    />
  </svg>
);

const ProgressSection = ({
  fileName,
  progress,
}: {
  fileName: string;
  progress: number;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Processing {fileName}...</span>
    </div>
    <Progress value={progress} className="h-2" />
  </div>
);

const ErrorSection = ({ message }: { message: string }) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
    {message}
  </div>
);

// =============================
// DOCX Processing Logic
// =============================
const processDocxTemplate = async (file: File, data: Record<string, any>) => {
  const zip = await JSZip.loadAsync(file);
  let documentXml = await zip.file("word/document.xml")?.async("string");
  let relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  let content_types = await zip.file("[Content_Types].xml")?.async("string");

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml || "", "application/xml");

  const pgSz = getElementByXpath(xmlDoc, "//w:sectPr/w:pgSz");
  const pgMar = getElementByXpath(xmlDoc, "//w:sectPr/w:pgMar");

  if (pgSz && pgMar) {
    const pageWidthTwips = parseInt(pgSz.getAttribute("w:w"), 10); // Page width in twips
    const leftMarginTwips = parseInt(pgMar.getAttribute("w:left"), 10); // Left margin in twips
    const rightMarginTwips = parseInt(pgMar.getAttribute("w:right"), 10); // Right margin in twips

    // Calculate available width
    const availableWidthTwips =
      pageWidthTwips - (leftMarginTwips + rightMarginTwips);
    const availableWidthEMU = availableWidthTwips * 635; // Convert to EMU

    // Optional: Convert to inches if needed
    const availableWidthInches = availableWidthTwips / 1440;
    console.log("Available width (inches):", availableWidthInches);
  } else {
    console.warn("Could not find pgSz or pgMar");
  }

  let modifiedXml = documentXml;
  const mediaFiles: { filename: string; buffer: Buffer }[] = [];

  for (const [key, value] of Object.entries(data)) {
    const [prefix, name] = key.split("__");
    const placeholder = `{{${name}}}`;
    const regex = new RegExp(placeholder, "g");

    if (typeof value === "string" && prefix === "img_url") {
      const imageData = await fetchImageAsBase64(value);
      const result = await insertImageIntoDocx(
        modifiedXml!,
        relsXml!,
        placeholder,
        imageData,
        200,
        400
      );
      const imageType = imageData.split("/")[1].split(";")[0];

      if (!content_types?.includes(`image/${imageType}`)) {
        content_types = content_types?.replace(
          "</Types>",
          `<Default ContentType="image/${imageType}" Extension="${imageType}"/></Types>`
        );
      }

      modifiedXml = result.modifiedXml;
      relsXml = result.newRelsXml;
      mediaFiles.push(result.media);
    } else {
      modifiedXml = modifiedXml?.replace(regex, String(value));
    }
  }

  zip.file("[Content_Types].xml", content_types);
  zip.file("word/document.xml", modifiedXml);
  zip.file("word/_rels/document.xml.rels", relsXml);
  mediaFiles.forEach((media) =>
    zip.file(`word/media/${media.filename}`, media.buffer)
  );

  const outputZip = await zip.generateAsync({ type: "blob" });
  FileSaver.saveAs(outputZip, `Generated-${file.name}`);
};

// =============================
// Helper Functions
// =============================
const fetchImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const insertImageIntoDocx = async (
  documentXml: string,
  relsXml: string,
  placeholder: string,
  imageData: string,
  height = 100,
  width = 100
) => {
  const base64Data = imageData.split(",")[1];
  const imageBuffer = Buffer.from(base64Data, "base64");
  const imageFilename = `image_${Date.now()}.png`;
  const imageId = `rId${Date.now()}`;
  const relationshipXml = `<Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageFilename}"/>`;
  const newRelsXml = relsXml.replace(
    "</Relationships>",
    `${relationshipXml}</Relationships>`
  );
  const drawingXml = `<w:drawing>
  <wp:inline distB="114300" distT="114300" distL="114300" distR="114300">
    <wp:extent cx="${width * 9525}" cy="${height * 9525}" />
    <wp:effectExtent b="0" l="0" r="0" t="0" />
    <wp:docPr id="1" name="${imageFilename}" />
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:nvPicPr>
            <pic:cNvPr id="0" name="${imageFilename}" />
            <pic:cNvPicPr preferRelativeResize="0" />
          </pic:nvPicPr>
          <pic:blipFill>
            <a:blip
              r:embed="${imageId}"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            />
            <a:srcRect b="0" l="0" r="0" t="0" />
            <a:stretch>
              <a:fillRect />
            </a:stretch>
          </pic:blipFill>
          <pic:spPr>
            <a:xfrm>
              <a:off x="0" y="0" />
              <a:ext
                cx="${width * 9525}"
                cy="${height * 9525}"
              />
            </a:xfrm>
            <a:prstGeom prst="rect" />
            <a:ln />
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>`;
  const placeholderPattern = new RegExp(
    `<w:t[^>]*>[^<]*${placeholder}[^<]*</w:t>`,
    "g"
  );
  const modifiedXml = documentXml.replace(placeholderPattern, drawingXml);

  return {
    modifiedXml,
    newRelsXml,
    media: { filename: imageFilename, buffer: imageBuffer },
  };
};

function getElementByXpath(xmlDoc: Document, xpath: string) {
  const namespaces = {
    w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  };
  const resolver = (prefix: string) => namespaces[prefix] || null;
  return xmlDoc.evaluate(
    xpath,
    xmlDoc,
    resolver,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
}
