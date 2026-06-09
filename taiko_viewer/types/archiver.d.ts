declare module "archiver" {
  type ArchiverFormat = "zip";

  type ArchiverEntryData = {
    name: string;
  };

  type ArchiverOptions = {
    zlib?: {
      level?: number;
    };
  };

  interface ArchiverInstance extends NodeJS.ReadWriteStream {
    file(filename: string, data: ArchiverEntryData): this;
    finalize(): Promise<void>;
    on(event: "error", listener: (error: Error) => void): this;
  }

  export default function archiver(format: ArchiverFormat, options?: ArchiverOptions): ArchiverInstance;
}
