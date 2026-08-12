"use client"

import { isValidPdfUrl } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";


export function usePdf(){
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [pdfError, setPdfError] = useState<string>("");

    const [UrlInput, setUrlInput] = useState<string>("");
    const [UrlError, setUrlError] = useState<string>("");
    const [urlLoading, setUrlLoading] = useState<boolean>(false);

    const handleFileSubmit = useCallback((file: File) => {
        if(file.type != "application/pdf") {
            setPdfError("uplaod a valid pdf .!")
        }

        setFile(file);
        setFileUrl(URL.createObjectURL(file));
        setFileName(file.name);

        setUrlInput("");
        setUrlError("");
    }, [])

    const handleUrlSubmit = useCallback(async () => {
        const url = UrlInput.trim();

        if(!url) return;

        if(!isValidPdfUrl(url)){
            setUrlError("please upload a valid pdf url .!");
            return;
        }

        setUrlLoading(true);
        setUrlError("");

        setFile(null);
        setFileUrl(url);


        const parts = url.split("/").pop()?.split("?")[0]??"document.pdf";

        setFileName(parts || "Remote.pdf");
        setUrlLoading(false);
    }, [UrlInput])


    const removePdf = useCallback(() => {
        setFile(null);
        setFileName("");
        setFileUrl(null);
        setUrlError("");
        setUrlInput("");
    }, [])

    useEffect(() => {
        return () => {
            if(fileUrl?.startsWith("blob:")){
                URL.revokeObjectURL(fileUrl);
            }
        }
    }, [fileUrl])

    return {
        file, 
        fileName, 
        fileUrl, 
        setFileUrl,
        setFileName,
        setFile,

        UrlInput,
        setUrlInput,
        pdfError,

        UrlError,
        urlLoading,

        handleFileSubmit, 
        handleUrlSubmit, 
        removePdf
    }

}