declare module 'pdf-parse' {
  interface PdfData {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }

  function parse(dataBuffer: Buffer): Promise<PdfData>;
  
  export default parse;
}