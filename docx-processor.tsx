"use client";
import { useState } from "react";
import JSZip from "jszip";
import FileSaver from "file-saver";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DocxProcessor() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setProcessing(true);
    setProgress(10);
    setError(""); 

    // Sample data - replace with your actual data source
    const dataObject = {
      first_name: "john",
      last_name: "doe",
      address: "a d d r e s s",
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAAcklEQVR4nGL52KfHgAQ2nZmIzLU8/BWZ27vuFDKXiYECMEQ1s5h3aiPzd6Z4IHMv//iJzNX/a0g1m4eoZha33mpkvow5Sgil30ZJf0fv36KazUNUM8vGf7OR+Tp/VJC5W+UUkLnpuhpUs3mIagYEAAD//4IxGiHuxeBEAAAAAElFTkSuQmCC",
    };

    try {
      await processDocxTemplate(file, dataObject);
      setProgress(100);
      toast({
        title: "Success",
        description: "Document processed successfully!",
      });
    } catch (error: any) {
      console.error("Error processing document:", error);
      setError(`Error: ${error?.message || "Failed to process document"}`);
    } finally {
      setTimeout(() => {
        setProcessing(false);
      }, 1000);
    }
  };

  // Function to insert an image into the DOCX file
  

  const processDocxTemplate = async (file: File, data: Record<string, any>) => {
    // Load the docx file as a zip
    const zip = await JSZip.loadAsync(file);
    setProgress(20);

    // Get document.xml content
    let documentXml = await zip.file("word/document.xml")?.async("string");
    let relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
    let content_types = await zip.file("[Content_Types].xml")?.async("string");
    console.log("Original XML:", documentXml?.substring(0, 500) + "...");
    setProgress(30);

    // Simple string replacement approach - more reliable for basic templates
    let modifiedXml = documentXml;
    let mediaFiles: { filename: string; buffer: Buffer }[] = [];

    // Replace all placeholders in the XML string
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const regex = new RegExp(placeholder, "g");

      if (typeof value === "string") {
        if (value.startsWith("data:image")) {
          // Handle image placeholders
          const result = insertImageIntoDocx(
            modifiedXml,
            relsXml,
            placeholder,
            value,
            120
          );
          const imageType = value.split("/")[1].split(";")[0];
          if (!content_types?.includes(`image/${imageType}`)) {
            content_types = content_types?.replace("</Types>", `<Default ContentType="image/${imageType}" Extension="${imageType}"/></Types>`);
          }
          modifiedXml = result.modifiedXml;
          relsXml = result.newRelsXml;
          mediaFiles.push(result.media);
          console.log(`Processed image placeholder: ${placeholder}`);
        } else {
          // Simple text replacement
          modifiedXml = modifiedXml?.replace(regex, value);
        }
      } else {
        // Handle other data types
        modifiedXml = modifiedXml?.replace(regex, String(value));
      }
    });

    // Update XML in zip
    zip.file("[Content_Types].xml", content_types);
    zip.file("word/document.xml", modifiedXml);
    zip.file("word/_rels/document.xml.rels", relsXml);
    
    // Add all media files to the zip
    mediaFiles.forEach(media => {
      zip.file(`word/media/${media.filename}`, media.buffer);
    });

    setProgress(80);

    // Generate new docx
    const outputZip = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(outputZip, `Generated-${file.name}`);

    setProgress(90);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors">
        <input
          type="file"
          accept=".docx"
          onChange={handleFileUpload}
          className="hidden"
          id="docx-upload"
        />
        <label
          htmlFor="docx-upload"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
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
          <span className="text-lg font-medium mb-1">Upload DOCX Template</span>
          <span className="text-sm text-gray-500">
            Drop your file here or click to browse
          </span>
        </label>
      </div>
      {processing && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing {fileName}...</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}


const insertImageIntoDocx = (documentXml: string | undefined, relsXml: string | undefined, placeholder: string, imageData: string, width = 100) => {
  // Extract the base64 data from the data URL
  const base64Data = imageData.split(',')[1];
  const imageBuffer = Buffer.from(base64Data, 'base64');
  
  // Generate a unique filename for the image
  const imageFilename = `image_${Date.now()}.png`;
  const imageId = `rId${Date.now()}`;
  
  // Create the relationship entry for the image
  const relationshipXml = `<Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageFilename}"/>`;
  
  // Insert the relationship into the existing relationships
  const newRelsXml = relsXml.replace('</Relationships>', `${relationshipXml}</Relationships>`);
  
  // Create the drawing XML for the image
  const drawingXml = `
    <w:drawing>
            <wp:inline distB="114300"
                       distT="114300"
                       distL="114300"
                       distR="114300">
                <wp:extent cx="${width * 9525}" cy="${width * 9525}" />
                <wp:effectExtent b="0"
                                 l="0"
                                 r="0"
                                 t="0" />
                <wp:docPr id="1"
                          name="${imageFilename}" />
                <a:graphic>
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:pic>
                            <pic:nvPicPr>
                                <pic:cNvPr id="0"
                                           name="${imageFilename}" />
                                <pic:cNvPicPr preferRelativeResize="0" />
                            </pic:nvPicPr>
                            <pic:blipFill>
                                <a:blip r:embed="${imageId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />
                                <a:srcRect b="0"
                                           l="0"
                                           r="0"
                                           t="0" />
                                <a:stretch>
                                    <a:fillRect />
                                </a:stretch>
                            </pic:blipFill>
                            <pic:spPr>
                                <a:xfrm>
                                    <a:off x="0"
                                           y="0" />
                                    <a:ext cx="${width * 9525}" cy="${width * 9525}" />
                                </a:xfrm>
                                <a:prstGeom prst="rect" />
                                <a:ln />
                            </pic:spPr>
                        </pic:pic>
                    </a:graphicData>
                </a:graphic>
            </wp:inline>
        </w:drawing>
  `;

  // Find and replace the placeholder in the document XML
  // Looking specifically for the text tag containing our placeholder
  const placeholderPattern = new RegExp(`<w:t[^>]*>[^<]*${placeholder}[^<]*</w:t>`, 'g');
  
  // Replace the placeholder text element with an empty text tag followed by our drawing
  const modifiedXml = documentXml.replace(placeholderPattern, (match) => {
    console.log(`Found placeholder: ${match}`);
    // Return an empty w:t tag followed by our drawing XML
    return `<w:t></w:t>${drawingXml}`;
  });

  return {
    modifiedXml,
    newRelsXml,
    media: {
      filename: imageFilename,
      buffer: imageBuffer
    }
  };
};