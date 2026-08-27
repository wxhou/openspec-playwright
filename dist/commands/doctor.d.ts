export interface DoctorOptions {
    json?: boolean;
}
export declare function isOptionalCheck(name: string): boolean;
export declare function doctor(options?: DoctorOptions): Promise<void>;
