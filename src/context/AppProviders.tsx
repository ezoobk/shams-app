import React from 'react';
import { SettingsProvider } from './SettingsContext';
import { CustomersProvider } from './CustomersContext';
import { DriversProvider } from './DriversContext';
import { PrintProvider } from './PrintContext';
import { LettersProvider } from './LettersContext';
import { ShippingOrdersProvider } from './ShippingOrdersContext';
import { MaterialsProvider } from './MaterialsContext';
import { EstimatesProvider } from './EstimatesContext';
import { WorkOrdersProvider } from './WorkOrdersContext';
import { InvoicesProvider } from './InvoicesContext';
import { AuthProvider } from './AuthContext';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <PrintProvider>
        <SettingsProvider>
          <CustomersProvider>
            <DriversProvider>
              <LettersProvider>
                <ShippingOrdersProvider>
                  <MaterialsProvider>
                    <EstimatesProvider>
                      <WorkOrdersProvider>
                        <InvoicesProvider>
                          {children}
                        </InvoicesProvider>
                      </WorkOrdersProvider>
                    </EstimatesProvider>
                  </MaterialsProvider>
                </ShippingOrdersProvider>
              </LettersProvider>
            </DriversProvider>
          </CustomersProvider>
        </SettingsProvider>
      </PrintProvider>
    </AuthProvider>
  );
};
