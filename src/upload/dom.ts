export interface UploadDomRefs {
  elTitle: HTMLInputElement;
  elYear: HTMLInputElement;
  elCountry: HTMLInputElement;
  elRating: HTMLInputElement;
  elTypeBtns: NodeListOf<HTMLButtonElement>;
  elSeriesOptions: HTMLElement;
  elMatchaOptions: HTMLElement;
  elCatBtns: NodeListOf<HTMLButtonElement>;
  elMatchaCatBtns: NodeListOf<HTMLButtonElement>;
  elHasSeason: HTMLInputElement;
  elBannerDrop: HTMLElement;
  elBannerInput: HTMLInputElement;
  elBannerPrevContainer: HTMLElement;
  elBannerPreview: HTMLImageElement;
  elBannerPlaceholder: HTMLElement;
  elBannerName: HTMLElement;
  btnCancel: HTMLButtonElement;
  btnSubmit: HTMLButtonElement;
  elSubmitError: HTMLElement;
  elSeasonTabs: HTMLElement;
  elSeasonList: HTMLElement;
  btnAddSeason: HTMLButtonElement;
  elUploadTabs: NodeListOf<HTMLButtonElement>;
  elUploadGrid: HTMLElement;
  elUploadTabInfo: HTMLElement;
  elUploadTabContent: HTMLElement;
  elUploadTitle: HTMLElement;
  elEpisodesList: HTMLElement;
  btnAddEpisode: HTMLButtonElement;
  btnAutoDetectR2: HTMLButtonElement;
  elStatusBtns: NodeListOf<HTMLButtonElement>;
}

export function getUploadDomRefs(): UploadDomRefs {
  return {
    elTitle: document.getElementById('up-title') as HTMLInputElement,
    elYear: document.getElementById('up-year') as HTMLInputElement,
    elCountry: document.getElementById('up-country') as HTMLInputElement,
    elRating: document.getElementById('up-rating') as HTMLInputElement,
    elTypeBtns: document.querySelectorAll('#up-type-group .btn') as NodeListOf<HTMLButtonElement>,
    elSeriesOptions: document.getElementById('up-series-options')!,
    elMatchaOptions: document.getElementById('up-matcha-options')!,
    elCatBtns: document.querySelectorAll('#up-series-category-group .btn') as NodeListOf<HTMLButtonElement>,
    elMatchaCatBtns: document.querySelectorAll('#up-matcha-category-group .btn') as NodeListOf<HTMLButtonElement>,
    elHasSeason: document.getElementById('up-has-season') as HTMLInputElement,
    elBannerDrop: document.getElementById('up-banner-drop')!,
    elBannerInput: document.getElementById('up-banner-input') as HTMLInputElement,
    elBannerPrevContainer: document.getElementById('up-banner-preview-container')!,
    elBannerPreview: document.getElementById('up-banner-preview') as HTMLImageElement,
    elBannerPlaceholder: document.getElementById('up-banner-placeholder')!,
    elBannerName: document.getElementById('up-banner-name')!,
    btnCancel: document.getElementById('btn-upload-cancel') as HTMLButtonElement,
    btnSubmit: document.getElementById('btn-upload-submit') as HTMLButtonElement,
    elSubmitError: document.getElementById('up-submit-error')!,
    elSeasonTabs: document.getElementById('up-season-tabs')!,
    elSeasonList: document.getElementById('up-season-list')!,
    btnAddSeason: document.getElementById('btn-add-season') as HTMLButtonElement,
    elUploadTabs: document.querySelectorAll('#upload-tabs .upload-tab') as NodeListOf<HTMLButtonElement>,
    elUploadGrid: document.getElementById('upload-grid-layout')!,
    elUploadTabInfo: document.getElementById('upload-tab-info')!,
    elUploadTabContent: document.getElementById('upload-tab-content')!,
    elUploadTitle: document.querySelector('#view-upload h1') as HTMLElement,
    elEpisodesList: document.getElementById('up-episodes-list')!,
    btnAddEpisode: document.getElementById('btn-add-episode') as HTMLButtonElement,
    btnAutoDetectR2: document.getElementById('btn-auto-detect-r2') as HTMLButtonElement,
    elStatusBtns: document.querySelectorAll('#up-status-group .btn') as NodeListOf<HTMLButtonElement>,
  };
}
