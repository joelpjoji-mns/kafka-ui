import { useAppInfo } from 'lib/hooks/api/appConfig';
import React from 'react';
import { ApplicationInfoEnabledFeaturesEnum } from 'generated-sources';
import { useNavigate } from 'react-router-dom';

interface GlobalSettingsContextProps {
  hasDynamicConfig: boolean;
  hasCooperativeOffsetReset: boolean;
}

export const GlobalSettingsContext =
  React.createContext<GlobalSettingsContextProps>({
    hasDynamicConfig: false,
    hasCooperativeOffsetReset: false,
  });

export const GlobalSettingsProvider: React.FC<
  React.PropsWithChildren<unknown>
> = ({ children }) => {
  const info = useAppInfo();
  const navigate = useNavigate();
  const [value, setValue] = React.useState<GlobalSettingsContextProps>({
    hasDynamicConfig: false,
    hasCooperativeOffsetReset: false,
  });

  React.useEffect(() => {
    if (info.data?.redirect && !info.isFetching) {
      navigate('login');
      return;
    }

    const features = info?.data?.response?.enabledFeatures;

    if (features) {
      setValue({
        hasDynamicConfig: features.includes(
          ApplicationInfoEnabledFeaturesEnum.DYNAMIC_CONFIG
        ),
        hasCooperativeOffsetReset: features.includes(
          ApplicationInfoEnabledFeaturesEnum.COOPERATIVE_OFFSET_RESET
        ),
      });
    }
  }, [info.data]);

  return (
    <GlobalSettingsContext.Provider value={value}>
      {children}
    </GlobalSettingsContext.Provider>
  );
};
