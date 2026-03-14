declare module 'html2pdf.js' {
  interface Html2PdfInstance {
    set(options: object): Html2PdfInstance;
    from(element: HTMLElement): Html2PdfInstance;
    save(): Promise<void>;
  }
  function html2pdf(): Html2PdfInstance;
  export = html2pdf;
}
