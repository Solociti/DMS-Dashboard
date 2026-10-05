import fs from "node:fs/promises";

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export class InvalidBlacklistAddressError extends Error {}

function normalizeAddress(value: unknown): string {
  if (typeof value !== "string") {
    throw new InvalidBlacklistAddressError("Enter a valid email address.");
  }

  const address = value.trim().toLowerCase();
  if (!emailPattern.test(address)) {
    throw new InvalidBlacklistAddressError("Enter a valid email address.");
  }

  return address;
}

export class TrackingBlacklistStore {
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async getAddresses(): Promise<string[]> {
    let contents: string;
    try {
      contents = await fs.readFile(this.filePath, "utf8");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      throw error;
    }

    return [
      ...new Set(
        contents
          .split(/\r?\n/)
          .map((address) => address.trim().toLowerCase())
          .filter((address) => emailPattern.test(address)),
      ),
    ].sort();
  }

  async addAddress(value: unknown): Promise<string[]> {
    const address = normalizeAddress(value);
    return this.updateAddresses((addresses) =>
      addresses.includes(address) ? addresses : [...addresses, address],
    );
  }

  async removeAddress(value: unknown): Promise<string[]> {
    const address = normalizeAddress(value);
    return this.updateAddresses((addresses) =>
      addresses.filter((entry) => entry !== address),
    );
  }

  private async updateAddresses(
    update: (addresses: string[]) => string[],
  ): Promise<string[]> {
    const operation = this.updateQueue.then(async () => {
      const addresses = update(await this.getAddresses()).sort();
      const contents = addresses.length > 0 ? `${addresses.join("\n")}\n` : "";
      await fs.writeFile(this.filePath, contents, "utf8");
      return addresses;
    });

    this.updateQueue = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }
}