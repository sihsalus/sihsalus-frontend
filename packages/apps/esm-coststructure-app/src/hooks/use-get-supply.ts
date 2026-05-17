export interface Supply {
  id: number;
  uuid: string;
  name: string;
  supplyType: string;
  unitAcquisition: string;
  unitConsumption: string;
  equivalence: number;
}

const useGetSupply = () => {
  return {
    // The current coststructure OMOD does not expose /module/coststructure/supply.
    // Keep the UI stable without issuing a request that always fails.
    supply: [],
    isError: undefined,
    isLoading: false,
    mutate: async () => [],
  };
};

export default useGetSupply;
