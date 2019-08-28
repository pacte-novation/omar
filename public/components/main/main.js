import React, { Component, Fragment } from 'react';
import {
  EuiButton,
  EuiForm,
  EuiFormRow,
  EuiHorizontalRule,
  EuiPage,
  EuiPageBody,
  EuiPageContent,
  EuiPageContentBody,
  EuiPageHeader,
  EuiPageHeaderSection,
  EuiImage,
  EuiConfirmModal,
  EuiOverlayMask,
  EuiSuperSelect,
  EuiCallOut,
  EuiProgress,
  EuiComboBox,
  EuiSpacer,
  EuiText,
  EuiDescriptionList,
  EuiFieldNumber
} from '@elastic/eui';
import io from "socket.io-client";

export class Main extends Component {
  constructor(props) {
    super(props);
    this.httpClient = this.props.httpClient;
    this.envVars = this.props.envVarsService.get();
    this.state = {
      selectedIndex: '',
      selectedTimeField: [],
      selectedPredictField: [],
      selectedFeatureFields: [],
      isModalVisibleTrain: false,
      isModalVisiblePredict: false,
      isTrainButtonDisabled: true,
      isPredictionButtonDisabled: false,
      isTimeFieldSelectDisabled: true,
      isPredictFieldSelectDisabled: true,
      openIndexAndCount: [],
      errorNoTime: false,
      dateFields: [],
      trainFields: [],
      predictFields: [],
      isFeaturesFieldSelectDisabled: true,
      timeStep: 4
    };
  }
  componentDidMount() {
    this.socket = io(window.location.protocol + '//' + window.location.hostname + ':' + this.envVars.socketPort);
    this.socket.on("progressTrain", (data) => { console.log(data); this.onProgressTrainReceive(data) });
    this.socket.on("progressPredict", (data) => { this.onProgressPredictReceive(data) });
    this.httpClient.get('../api/omar/indices').then((resp) => {
      this.setState({
        openIndexAndCount: resp.data
      });
    });
    this.httpClient.get('../api/omar/omar-model').then((resp) => {
      this.setState(resp.data);
    });
  }
  componentWillUnmount() {
    this.socket.disconnect();
  }
  closeModalTrain = () => {
    this.setState({ isModalVisibleTrain: false });
  };
  showModalTrain = () => {
    this.setState({ isModalVisibleTrain: true });
  };
  closeModalPredict = () => {
    this.setState({ isModalVisiblePredict: false });
  };
  showModalPredict = () => {
    this.setState({ isModalVisiblePredict: true });
  };
  onProgressTrainReceive = (data) => {
    const { progressTrain, errorTrain, messTrain, lastStageOfTrain } = data;
    this.setState({
      progressTrain: progressTrain,
      errorTrain: errorTrain,
      messTrain: messTrain,
      lastStageOfTrain: lastStageOfTrain
    })
    if (errorTrain || (progressTrain >= 100 && lastStageOfTrain)) {
      this.httpClient.get('../api/omar/omar-model').then((resp) => {
        this.setState(resp.data);
      });
      this.setState({
        isTrainInProgress: false,
        isTrainButtonDisabled: false,
        isPredictionButtonDisabled: false
      })
    }
  }
  onProgressPredictReceive = (data) => {
    this.setState(data);
    const { progressPredict, errorPredict, messPredict, lastStageOfPredict } = data;
    this.setState({
      progressPredict: progressPredict,
      errorPredict: errorPredict,
      messPredict: messPredict
    });
    if (errorPredict || progressPredict >= 100) {
      this.setState({
        isPredictionInProgress: false
      });
    }
  }
  onSelectedIndexChange = (value) => {
    this.httpClient.get('../api/omar/fields/' + value).then((resp) => {
      const { fDate, fNoDate } = resp.data;
      this.setState({
        selectedIndex: value,
        dateFields: fDate.map(el => ({ label: el })),
        predictFields: fNoDate.map(el => ({ label: el })),
        featureFields: fNoDate.map(el => ({ label: el })),
        isTimeFieldSelectDisabled: false,
        isPredictFieldSelectDisabled: true,
        isTrainButtonDisabled: true,
        isPredictionButtonDisabled: false,
        selectedPredictField: [],
        errorNoTime: (fDate.length < 1),
        selectedFeatureFields: [],
        selectedTimeField: [],
        isFeaturesFieldSelectDisabled: true,
        errorTrain: false
      });
    });
  }
  onselectedTimeFieldChange = (value) => {
    this.setState({
      selectedTimeField: value,
      selectedPredictField: [],
      isPredictFieldSelectDisabled: false,
      isTrainButtonDisabled: true,
      selectedFeatureFields: [],
      isFeaturesFieldSelectDisabled: true,
      errorTrain: false,
      errorPredict: false,
    });
  }
  onSelectedPredictFieldChange = (selectedPredictField) => {
    this.setState({
      selectedPredictField: selectedPredictField,
      isTrainButtonDisabled: true,
      featureFieldsWithoutPredict: this.state.featureFields.filter(el => el.label != selectedPredictField[0].label),
      selectedFeatureFields: [],
      isFeaturesFieldSelectDisabled: false,
      errorTrain: false,
      errorPredict: false,
    });
  }

  onChangeTimeField = selectedTimeField => {
    this.setState({
      selectedTimeField: selectedTimeField,
      selectedPredictField: [],
      isPredictFieldSelectDisabled: false,
      isTrainButtonDisabled: true,
      selectedFeatureFields: [],
      isFeaturesFieldSelectDisabled: true,
      errorTrain: false,
      errorPredict: false,
    })
  }
  onChangeFeatures = selectedFeatureFields => {
    this.setState({
      selectedFeatureFields: selectedFeatureFields,
      isTrainButtonDisabled: selectedFeatureFields.length == 0,
      errorTrain: false,
      errorPredict: false,
    })
  }
  onTrainButtonClick = () => {
    const { selectedIndex, selectedTimeField, selectedPredictField, selectedFeatureFields, timeStep } = this.state;
    const payload = {
      index: selectedIndex,
      timeField: selectedTimeField[0].label,
      predictField: selectedPredictField[0].label,
      featureFields: selectedFeatureFields.map(el => el.label).join(','),
      timeStep: timeStep
    }
    this.httpClient.post('../api/omar/train', payload)
    this.setState({
      isModalVisibleTrain: false,
      isTrainInProgress: true,
      isPredictionButtonDisabled: false
    });
  }
  onPredictButtonClick = () => {
    this.httpClient.post('../api/omar/predict');
    this.setState({
      isModalVisiblePredict: false,
      isPredictionInProgress: true,
      isTrainButtonDisabled: true
    });
  }
  displayErrorNoTimeField = (isVisible) => {
    if (isVisible) {
      return (
        <EuiCallOut title="Sorry, there is no 'date' type in your index ! Choose another one. " color="warning" iconType="alert" />
      )
    }
  }
  displayProgressBarPredict = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow>
            <EuiButton onClick={this.onCancelPredict} color='danger' style={{ width: 600 }} fill={true}> Cancel </EuiButton>
          </EuiFormRow>
          <EuiFormRow>
            <EuiProgress value={this.state.progressPredict} max={100} size="s" />
          </EuiFormRow>
          <p>{this.state.messPredict} </p>
        </div>
      );
    };
  }
  onCancelPredict = () => {
    this.socket.emit("cancelPredict");
    this.setState({
      isPredictInProgress: false,
      isPredictionButtonDisabled: false,
      isPredictionInProgress: false
    })
  }
  onCancelTrain = () => {
    this.socket.emit("cancelTrain");
    this.setState({
      isTrainInProgress: false,
      isTrainButtonDisabled: false,
      isPredictionButtonDisabled: false
    })
  }
  displayProgressBarTrain = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow>
            <EuiButton onClick={this.onCancelTrain} color='danger' style={{ width: 600 }} fill={true}>Cancel</EuiButton>
          </EuiFormRow>
          <EuiFormRow>
            <EuiProgress value={this.state.progressTrain} max={100} size="s" />
          </EuiFormRow>
          <p>{this.state.messTrain} </p>
        </div>
      );
    };
  }
  displayTrainButton = (isVisible) => {
    if (isVisible) {
      return (
        <EuiFormRow>
          <EuiButton onClick={this.showModalTrain} isDisabled={this.state.isTrainButtonDisabled} style={{ width: 600 }} fill={true}>Train</EuiButton>
        </EuiFormRow>
      );
    };
  }
  displayPredictButton = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiFormRow >
            <EuiButton onClick={this.showModalPredict} isDisabled={this.state.isPredictionButtonDisabled || !this.state.currentModel} style={{ width: 600 }} fill={true}>
              Predict
          </EuiButton>
          </EuiFormRow>
          {this.displayModelParams(this.state.currentModel)}
        </div>
      );
    };
  }
  displayModelParams = (isVisible) => {
    if (isVisible) {
      const lisFeatures = this.state.currentModel ? this.state.currentModel.featureFields.map(el => ({ description: ' - ' + el })) : '';
      const text = [<h2 key={0}>THE MODEL</h2>,
      <ul key={3}>
        <li>
          <strong>{this.state.currentModel ? 'Index : ' : ''}</strong>
          {this.state.currentModel ? this.state.currentModel.index : ''}
        </li>
        <li>
          <strong>{this.state.currentModel ? 'Time Field : ' : ''}</strong>
          {this.state.currentModel ? this.state.currentModel.timeField : ''}
        </li>
        <li><strong>{this.state.currentModel ? 'Predict Field : ' : ''}</strong>
          {this.state.currentModel ? this.state.currentModel.predictField : ''}
        </li>
        <li><strong>{this.state.currentModel ? 'Features : ' : ''}</strong>
          <EuiSpacer size="xs" />
          <EuiDescriptionList listItems={lisFeatures} align="left" />
        </li>
      </ul>,]
      return (
        <div style={{ maxWidth: '400px' }}>
          <EuiPageContent className="guideDemo__textLines" style={{ padding: 10 }} verticalPosition="center" horizontalPosition="center">
            <EuiPageContentBody>
              <EuiText >{text}</EuiText>
            </EuiPageContentBody>
          </EuiPageContent>
        </div>
      );
    }
  }

  optionDisplay = (index, count) => {
    return (
      <Fragment>
        <p>{index}</p>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          <p className="euiTextColor--subdued">
            {count} documents
          </p>
        </EuiText>
      </Fragment>
    );
  }
  displayModalTrain = (isVisible) => {
    if (isVisible) {
      const { openIndexAndCount, selectedIndex, selectedPredictField } = this.state;
      const count = openIndexAndCount.find(el => el.index == selectedIndex).count
      return (
        <EuiOverlayMask>
          <EuiConfirmModal
            title="Train"
            onCancel={this.closeModalTrain}
            onConfirm={this.onTrainButtonClick}
            cancelButtonText="Cancel"
            confirmButtonText="Train"
            defaultFocusedButton="confirm">
            <p>You&rsquo;re about to train the default model on the {count} documents of the index {selectedIndex} to predict the field {selectedPredictField[0].label} </p>
            <p>Are you sure you want to do this?</p>
          </EuiConfirmModal>
        </EuiOverlayMask>
      );
    }
  }
  displayModalPredict = (isVisible) => {
    if (isVisible) {
      return (
        <EuiOverlayMask>
          <EuiConfirmModal
            title="Predict"
            onCancel={this.closeModalPredict}
            onConfirm={this.onPredictButtonClick}
            cancelButtonText="Cancel"
            confirmButtonText="Predict"
            defaultFocusedButton="confirm">
            <p>You&rsquo;re about to launch the prediction on the default trained model.</p>
            <p>Are you sure you want to do this?</p>
          </EuiConfirmModal>
        </EuiOverlayMask>
      );
    }
  }
  displayMessageError = (message) => {
    return <p>{message}</p>
  }

  onChangeTimeStep = e => {
    const selectedTime = parseInt(e.target.value, 10);
    if (selectedTime > 0 && this.state.selectedFeatureFields.length > 1) {
      this.setState({
        timeStep: isNaN(selectedTime) ? '' : selectedTime,
        isTrainButtonDisabled: false
      });
    }
    else {
      this.setState({ isTrainButtonDisabled: true })
    }
  };


  displayMessErrorTrain = (isVisible) => {
    if (isVisible) {
      return (
        <div>
          <EuiCallOut title={this.displayMessageError(this.state.messTrain)} color="warning" iconType="alert" />
        </div>
      )
    }
  }

  render() {
    return (
      <EuiPage >
        <EuiPageBody>
          <EuiPageHeader>
            <EuiPageHeaderSection  >
              <EuiImage
                size="l"
                url='../plugins/omar/ressources/omar_logo_text.svg'
                alt="omar"
              />
            </EuiPageHeaderSection>
          </EuiPageHeader>
          {this.displayErrorNoTimeField(this.state.errorNoTime)}
          {this.displayMessErrorTrain(this.state.errorTrain)}
          <EuiPageContent verticalPosition="center" horizontalPosition="center" >
            <EuiText><h2 >TEMPORAL ANN</h2></EuiText>
            <br />
            <EuiPageContentBody  >
              <EuiForm >
                <EuiFormRow label="Pick an opened index" >
                  <EuiSuperSelect
                    options={this.state.openIndexAndCount.map(el => ({ value: el.index, inputDisplay: el.index, dropdownDisplay: this.optionDisplay(el.index, el.count) }))}
                    valueOfSelected={this.state.selectedIndex}
                    onChange={this.onSelectedIndexChange}
                    hasDividers
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the time reference field"  >
                  <EuiComboBox
                    singleSelection={{ asPlainText: true }}
                    isClearable={false}
                    options={this.state.dateFields}
                    selectedOptions={this.state.selectedTimeField}
                    isDisabled={this.state.isTimeFieldSelectDisabled || this.state.errorNoTime}
                    onChange={this.onChangeTimeField}
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the field that will be predict"  >
                  <EuiComboBox
                    singleSelection={{ asPlainText: true }}
                    isClearable={false}
                    options={this.state.predictFields}
                    selectedOptions={this.state.selectedPredictField}
                    isDisabled={this.state.isPredictFieldSelectDisabled}
                    onChange={this.onSelectedPredictFieldChange}
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the fields that will be in the training" >
                  <EuiComboBox
                    options={this.state.featureFieldsWithoutPredict}
                    selectedOptions={this.state.selectedFeatureFields}
                    isDisabled={this.state.isFeaturesFieldSelectDisabled}
                    onChange={this.onChangeFeatures}
                  />
                </EuiFormRow>
                <EuiFormRow label="Pick the time in minute for the resample bigger than 1min">
                  <EuiFieldNumber
                    min={1}
                    placeholder={4}
                    onChange={this.onChangeTimeStep}
                  />
                </EuiFormRow>
                {this.displayTrainButton(!this.state.isTrainInProgress)}
                {this.displayModalTrain(this.state.isModalVisibleTrain)}
                {this.displayProgressBarTrain(this.state.isTrainInProgress)}
                <EuiHorizontalRule margin="s" />
                <EuiSpacer size="s" />
                {this.displayPredictButton(!this.state.isPredictionInProgress)}
                {this.displayModalPredict(this.state.isModalVisiblePredict)}
                {this.displayProgressBarPredict(this.state.isPredictionInProgress)}
              </EuiForm>
            </EuiPageContentBody>
          </EuiPageContent>
        </EuiPageBody>
      </EuiPage>
    );
  }
}
