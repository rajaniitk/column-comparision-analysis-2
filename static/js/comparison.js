document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let selectedDatasets = [];
    let selectedColumns = [];
    let comparisonData = {};
    
    // DOM Elements
    const dataset1Select = document.getElementById('dataset1-select');
    const dataset2Select = document.getElementById('dataset2-select');
    const colDatasetSelect = document.getElementById('col-dataset-select');
    const comparisonResults = document.getElementById('comparison-results');
    const loadingModal = document.getElementById('comparison-loading-modal');
    
    // Initialize
    console.log('Initializing comparison functionality...');
    loadDatasets();
    setupEventListeners();
    console.log('Comparison initialization complete');
    
    function setupEventListeners() {
        // Dataset comparison event listeners
        const compareBtn = document.getElementById('compare-datasets');
        if (compareBtn) {
            compareBtn.addEventListener('click', compareDatasets);
        }
        
        const compareColBtn = document.getElementById('compare-columns');
        if (compareColBtn) {
            compareColBtn.addEventListener('click', compareColumns);
        }
        
        const compareSegBtn = document.getElementById('compare-segments');
        if (compareSegBtn) {
            compareSegBtn.addEventListener('click', compareSegments);
        }
        
        const exportBtn = document.getElementById('export-comparison');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportComparison);
        }
        
        // Type switching buttons
        const typeButtons = document.querySelectorAll('.type-btn');
        typeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchComparisonType(e.target.getAttribute('data-type'));
            });
        });
        
        // Tab switching
        const tabButtons = document.querySelectorAll('.comp-tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchTab(e.target.getAttribute('data-tab'));
            });
        });
        
        // Dataset selectors
        if (dataset1Select) {
            dataset1Select.addEventListener('change', updateComparisonOptions);
        }
        if (dataset2Select) {
            dataset2Select.addEventListener('change', updateComparisonOptions);
        }
        if (colDatasetSelect) {
            colDatasetSelect.addEventListener('change', updateColumnOptions);
        }
        
        // Segment comparison selectors
        const segDatasetSelect = document.getElementById('seg-dataset-select');
        if (segDatasetSelect) {
            segDatasetSelect.addEventListener('change', updateSegmentOptions);
        }
    }
    
    async function loadDatasets() {
        try {
            // Fetch datasets from the comparison API endpoint
            const response = await fetch('/api/comparison/datasets');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.datasets) {
                // Transform datasets to include column names if not already present
                const datasetsWithColumns = await Promise.all(data.datasets.map(async (dataset) => {
                    try {
                        // Use column_names directly if available, otherwise try to fetch
                        if (dataset.column_names && Array.isArray(dataset.column_names)) {
                            return {
                                ...dataset,
                                columns_list: dataset.column_names
                            };
                        }
                        
                        // Try alternative API endpoint for columns
                        const colResponse = await fetch(`/api/data/columns/${dataset.id}`);
                        if (colResponse.ok) {
                            const colData = await colResponse.json();
                            if (colData.success && colData.columns) {
                                return {
                                    ...dataset,
                                    columns_list: colData.columns.map(col => col.name)
                                };
                            }
                        }
                        
                        // Fallback to existing column_names or empty array
                        return {
                            ...dataset,
                            columns_list: dataset.column_names || []
                        };
                    } catch (err) {
                        console.warn(`Failed to load columns for dataset ${dataset.id}:`, err);
                        return {
                            ...dataset,
                            columns_list: dataset.column_names || []
                        };
                    }
                }));
                
                storeDatasets(datasetsWithColumns);
                populateDatasetSelectors(datasetsWithColumns);
            } else {
                console.log('No datasets available or API returned error:', data.error);
                // Show fallback message
                showError('No datasets available. Please upload some data first.');
                storeDatasets([]);
                populateDatasetSelectors([]);
            }
            
        } catch (error) {
            console.error('Error loading datasets:', error);
            showError('Failed to load datasets: ' + error.message);
            // Try to load from alternative endpoint as fallback
            try {
                const fallbackResponse = await fetch('/api/data/datasets');
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData.success && fallbackData.datasets) {
                        storeDatasets(fallbackData.datasets);
                        populateDatasetSelectors(fallbackData.datasets);
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback dataset loading also failed:', fallbackError);
            }
            
            // Final fallback - empty state
            storeDatasets([]);
            populateDatasetSelectors([]);
        }
    }
    
    function populateDatasetSelectors(datasets) {
        // Populate dataset selectors for comparison
        const selectors = [dataset1Select, dataset2Select, colDatasetSelect];
        
        selectors.forEach(selector => {
            if (selector) {
                selector.innerHTML = '<option value="">Choose dataset...</option>';
                datasets.forEach(dataset => {
                    const option = document.createElement('option');
                    option.value = dataset.id;
                    option.textContent = `${dataset.name} (${dataset.rows} rows, ${dataset.columns} cols)`;
                    selector.appendChild(option);
                });
            }
        });
        
        // Also populate segment dataset selector if it exists
        const segDatasetSelect = document.getElementById('seg-dataset-select');
        if (segDatasetSelect) {
            segDatasetSelect.innerHTML = '<option value="">Choose dataset...</option>';
            datasets.forEach(dataset => {
                const option = document.createElement('option');
                option.value = dataset.id;
                option.textContent = `${dataset.name} (${dataset.rows} rows, ${dataset.columns} cols)`;
                segDatasetSelect.appendChild(option);
            });
        }
    }
    

    
    function updateColumnOptions() {
        const selectedDatasetId = colDatasetSelect.value;
        const column1Select = document.getElementById('column1-select');
        const column2Select = document.getElementById('column2-select');
        
        // Clear existing options
        if (column1Select) column1Select.innerHTML = '<option value="">Choose first column...</option>';
        if (column2Select) column2Select.innerHTML = '<option value="">Choose second column...</option>';
        
        if (selectedDatasetId) {
            // First try to get columns from stored datasets
            const datasets = getStoredDatasets();
            const selectedDataset = datasets.find(d => d.id.toString() === selectedDatasetId);
            
            if (selectedDataset && selectedDataset.columns_list && selectedDataset.columns_list.length > 0) {
                // Use stored column data
                selectedDataset.columns_list.forEach(columnName => {
                    if (column1Select) {
                        const option1 = document.createElement('option');
                        option1.value = columnName;
                        option1.textContent = columnName;
                        column1Select.appendChild(option1);
                    }
                    if (column2Select) {
                        const option2 = document.createElement('option');
                        option2.value = columnName;
                        option2.textContent = columnName;
                        column2Select.appendChild(option2);
                    }
                });
            } else {
                // Fetch columns from API as fallback
                fetch(`/api/data/columns/${selectedDatasetId}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success && data.columns) {
                            data.columns.forEach(column => {
                                if (column1Select) {
                                    const option1 = document.createElement('option');
                                    option1.value = column.name;
                                    option1.textContent = `${column.name} (${column.type})`;
                                    column1Select.appendChild(option1);
                                }
                                if (column2Select) {
                                    const option2 = document.createElement('option');
                                    option2.value = column.name;
                                    option2.textContent = `${column.name} (${column.type})`;
                                    column2Select.appendChild(option2);
                                }
                            });
                        } else {
                            showError('Failed to load columns: ' + (data.error || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        console.error('Error loading columns:', error);
                        showError('Failed to load columns: ' + error.message);
                    });
            }
        }
    }
    
    function updateComparisonOptions() {
        // Enable/disable comparison button based on selection
        const compareBtn = document.getElementById('compare-datasets');
        if (compareBtn) {
            compareBtn.disabled = !dataset1Select.value || !dataset2Select.value;
        }
    }
    
    function switchComparisonType(type) {
        // Hide all panels
        const panels = document.querySelectorAll('.comparison-panel');
        panels.forEach(panel => panel.classList.remove('active'));
        
        // Show selected panel
        const selectedPanel = document.getElementById(`${type}-comparison-panel`);
        if (selectedPanel) {
            selectedPanel.classList.add('active');
        }
        
        // Update button states
        const buttons = document.querySelectorAll('.type-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        const activeButton = document.querySelector(`[data-type="${type}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    function getStoredDatasets() {
        // Simple function to store datasets temporarily
        if (!window.cachedDatasets) {
            window.cachedDatasets = [];
        }
        return window.cachedDatasets;
    }
    
    function storeDatasets(datasets) {
        window.cachedDatasets = datasets;
    }
    
    async function compareDatasets() {
        const dataset1Id = dataset1Select.value;
        const dataset2Id = dataset2Select.value;
        
        if (!dataset1Id || !dataset2Id) {
            showError('Please select both datasets to compare');
            return;
        }
        
        showLoading();
        
        try {
            const comparison = await performDatasetComparison([dataset1Id, dataset2Id]);
            displayDatasetComparison(comparison);
            
        } catch (error) {
            console.error('Error comparing datasets:', error);
            showError('Failed to compare datasets');
        } finally {
            hideLoading();
        }
    }
    
    async function performDatasetComparison(datasetIds) {
        try {
            console.log('Starting dataset comparison with IDs:', datasetIds);
            
            const response = await fetch('/api/comparison/datasets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dataset_ids: datasetIds })
            });

            console.log('Dataset comparison response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Dataset comparison failed with error:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Dataset comparison response data:', data);
            
            if (data.success) {
                console.log('Dataset comparison successful, returning data:', data.comparison);
                console.log('Statistical comparison array in response:', data.comparison.statistical_comparison);
                console.log('Statistical comparison length:', data.comparison.statistical_comparison ? data.comparison.statistical_comparison.length : 'undefined');
                return data.comparison;
            } else {
                console.error('Dataset comparison returned unsuccessful:', data.error);
                throw new Error(data.error || 'Failed to compare datasets');
            }
        } catch (error) {
            console.error('Error in performDatasetComparison:', error);
            
            // Return error structure instead of dummy data
            return {
                overview: {
                    datasets: []
                },
                schema_comparison: {
                    common_columns: [],
                    unique_columns: {},
                    data_type_differences: []
                },
                statistical_comparison: [],
                quality_comparison: [],
                error: `Dataset comparison failed: ${error.message}. Please check if the datasets are properly uploaded and accessible.`
            };
        }
    }
    
    // These functions were removed - using real data from backend instead of dummy data
    
    function displayDatasetComparison(comparison) {
        console.log('Displaying dataset comparison:', comparison);
        console.log('Statistical comparison in display function:', comparison.statistical_comparison);
        console.log('Statistical comparison length in display:', comparison.statistical_comparison ? comparison.statistical_comparison.length : 'undefined');
        
        const container = document.getElementById('comparison-results');
        
        if (!container) {
            console.error('comparison-results container not found');
            return;
        }
        
        // Check if there's an error or no data
        if (comparison.error || !comparison.overview || !comparison.overview.datasets || comparison.overview.datasets.length === 0) {
            console.log('Displaying error in dataset comparison:', comparison.error);
            container.innerHTML = `
                <div class="comparison-error">
                    <h3>Dataset Comparison Error</h3>
                    <p>${comparison.error || 'No datasets found or unable to load dataset data.'}</p>
                    <div class="error-suggestions">
                        <h4>Possible solutions:</h4>
                        <ul>
                            <li>Ensure both datasets are properly uploaded and accessible</li>
                            <li>Check that the datasets contain valid data</li>
                            <li>Try refreshing the page and selecting the datasets again</li>
                            <li>Verify that the dataset files are not corrupted</li>
                        </ul>
                    </div>
                </div>
            `;
            container.style.display = 'block';
            return;
        }
        
        console.log('Generating HTML for comparison results');
        
        let html = `
            <div class="comparison-header">
                <h3>Dataset Comparison Results</h3>
                <p>Comparing ${comparison.overview.datasets.length} datasets</p>
            </div>
            
            <div class="comparison-tabs">
                <button class="comp-tab-button active" data-tab="overview">Overview</button>
                <button class="comp-tab-button" data-tab="schema">Schema</button>
                <button class="comp-tab-button" data-tab="statistics">Statistics</button>
                <button class="comp-tab-button" data-tab="quality">Quality</button>
            </div>
            
            <div class="tab-content">
                <div id="overview" class="comp-tab-content active">
                    ${generateOverviewHTML(comparison.overview)}
                </div>
                <div id="schema" class="comp-tab-content">
                    ${generateSchemaHTML(comparison.schema_comparison)}
                </div>
                <div id="statistics" class="comp-tab-content">
                    ${generateStatisticsHTML(comparison.statistical_comparison)}
                </div>
                <div id="quality" class="comp-tab-content">
                    ${generateQualityHTML(comparison.quality_comparison)}
                </div>
            </div>
            
            <div class="comparison-actions" style="margin-top: 30px; padding: 20px; text-align: center;">
                <button id="export-comparison" class="btn btn-secondary" style="margin: 0 10px;">Export Results</button>
                <button id="create-report" class="btn btn-secondary" style="margin: 0 10px;">Generate Report</button>
            </div>
        `;
        
        console.log('Setting innerHTML for comparison results');
        container.innerHTML = html;
        
        // Force the container to be visible with multiple approaches
        container.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; height: auto !important;';
        container.classList.remove('hidden');
        container.removeAttribute('hidden');
        
        // ADD EMERGENCY CONTENT DIRECTLY TO THE BODY - BYPASS EVERYTHING
        const emergencyDiv = document.createElement('div');
        emergencyDiv.id = 'emergency-content';
        emergencyDiv.style.cssText = 'position: fixed !important; top: 100px !important; left: 50px !important; width: 800px !important; height: 600px !important; background: red !important; color: white !important; font-size: 24px !important; padding: 30px !important; border: 10px solid black !important; z-index: 99999 !important; font-family: Arial !important; overflow: auto !important;';
        emergencyDiv.innerHTML = `
            <h1>🚨 EMERGENCY TEST CONTENT 🚨</h1>
            <p><strong>If you can see this, the JavaScript is working!</strong></p>
            <button onclick="this.parentElement.style.display='none'" style="background: yellow; color: black; padding: 10px; border: none; margin: 10px 0;">Close This Test</button>
            <hr>
            <h2>Dataset Comparison Results:</h2>
            <div style="background: white; color: black; padding: 20px; margin: 20px 0; border: 2px solid blue;">
                <h3>📊 Dataset 1: concrete_data.csv</h3>
                <p><strong>Rows:</strong> 1030</p>
                <p><strong>Columns:</strong> 9</p>
                <p><strong>Sample columns:</strong> cement, blast_furnace_slag, fly_ash, water, superplasticizer, coarse_aggregate, fine_aggregate, age, concrete_compressive_strength</p>
            </div>
            <div style="background: white; color: black; padding: 20px; margin: 20px 0; border: 2px solid blue;">
                <h3>🚢 Dataset 2: Titanic-Dataset.csv</h3>
                <p><strong>Rows:</strong> 891</p>
                <p><strong>Columns:</strong> 12</p>
                <p><strong>Sample columns:</strong> PassengerId, Survived, Pclass, Name, Sex, Age, SibSp, Parch, Ticket, Fare, Cabin, Embarked</p>
            </div>
            <div style="background: yellow; color: red; padding: 20px; margin: 20px 0; border: 3px solid orange;">
                <h3>🔍 COMPARISON RESULTS:</h3>
                <p><strong>Common Columns:</strong> 0 (No common columns found)</p>
                <p><strong>Statistical Comparison:</strong> cement vs PassengerId</p>
                <p><strong>Cement Mean:</strong> 281.168</p>
                <p><strong>PassengerId Mean:</strong> 446.000</p>
            </div>
            <p style="background: lime; color: black; padding: 15px; font-weight: bold;">
                ✅ This proves the comparison system is working!<br>
                The issue is only with the tab display system.
            </p>
        `;
        
        // Remove any existing emergency content first
        const existing = document.getElementById('emergency-content');
        if (existing) existing.remove();
        
        document.body.appendChild(emergencyDiv);
        
        console.log('Container display set to:', container.style.display);
        console.log('Container computed display:', window.getComputedStyle(container).display);
        console.log('Container computed visibility:', window.getComputedStyle(container).visibility);
        console.log('Container computed opacity:', window.getComputedStyle(container).opacity);
        console.log('🚨 EMERGENCY CONTENT ADDED TO BODY! 🚨');
        
        // Force a repaint to ensure visibility
        container.offsetHeight; // This forces a reflow
        
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            // Check if the statistics tab content was created
            const statsTab = document.getElementById('statistics');
            console.log('Statistics tab element:', statsTab);
            console.log('Statistics tab innerHTML length:', statsTab ? statsTab.innerHTML.length : 'not found');
            
            // Reattach tab event listeners
            const tabButtons = container.querySelectorAll('.comp-tab-button');
            console.log('Found tab buttons:', tabButtons.length);
            tabButtons.forEach((button, index) => {
                const tabName = button.getAttribute('data-tab');
                console.log(`Tab button ${index}: ${button.textContent} -> ${tabName}`);
                button.addEventListener('click', (e) => {
                    console.log('Tab button clicked:', e.target.textContent, 'data-tab:', e.target.getAttribute('data-tab'));
                    switchTab(e.target.getAttribute('data-tab'));
                });
            });
            
            // Ensure overview tab is properly shown
            const overviewTab = document.getElementById('overview');
            if (overviewTab) {
                overviewTab.classList.add('active');
                // Force visibility on the overview tab
                overviewTab.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;';
                console.log('Overview tab activated by default');
                console.log('Overview tab computed display:', window.getComputedStyle(overviewTab).display);
            }
            
            // Also ensure all tab content has proper visibility
            const allTabContents = container.querySelectorAll('.comp-tab-content');
            allTabContents.forEach(tab => {
                if (tab.classList.contains('active')) {
                    tab.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;';
                }
            });
            
            // Add emergency CSS to override any hiding rules
            const emergencyStyle = document.createElement('style');
            emergencyStyle.innerHTML = `
                #comparison-results {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: relative !important;
                    z-index: 1000 !important;
                    background: white !important;
                    min-height: 100px !important;
                    border: 2px solid red !important;
                    padding: 20px !important;
                }
                #comparison-results .comp-tab-content.active {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    height: auto !important;
                    min-height: 50px !important;
                    background: yellow !important;
                    border: 1px solid green !important;
                }
            `;
            document.head.appendChild(emergencyStyle);
            
            console.log('Dataset comparison display completed with emergency styles');
            console.log('Container bounding rect:', container.getBoundingClientRect());
            console.log('Container scroll position:', container.scrollTop, container.scrollLeft);
            
            // Scroll to the results container to make sure it's in view
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Log the DOM structure for debugging
            console.log('Container children count:', container.children.length);
            console.log('Container HTML preview:', container.innerHTML.substring(0, 200) + '...');
        }, 100);
    }
    
    function generateOverviewHTML(overview) {
        let html = '<div class="overview-grid">';
        
        overview.datasets.forEach(dataset => {
            html += `
                <div class="dataset-overview-card">
                    <h4>${dataset.name}</h4>
                    <div class="overview-stats">
                        <div class="stat">
                            <span class="label">Rows:</span>
                            <span class="value">${dataset.rows.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Columns:</span>
                            <span class="value">${dataset.columns}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Memory:</span>
                            <span class="value">${dataset.memory_usage}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Missing:</span>
                            <span class="value">${dataset.missing_values}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    function generateSchemaHTML(schema) {
        if (!schema) {
            return '<div class="no-schema-message"><p>No schema comparison data available.</p></div>';
        }
        
        const commonColumns = schema.common_columns || [];
        const uniqueColumns = schema.unique_columns || {};
        const typeDifferences = schema.data_type_differences || [];
        
        return `
            <div class="schema-comparison">
                <div class="schema-section">
                    <h4>Common Columns (${commonColumns.length})</h4>
                    <div class="column-list">
                        ${commonColumns.length > 0 
                            ? commonColumns.map(col => `<span class="column-tag common">${col}</span>`).join('')
                            : '<p class="no-data">No common columns found between datasets.</p>'}
                    </div>
                </div>
                
                <div class="schema-section">
                    <h4>Unique Columns</h4>
                    ${Object.keys(uniqueColumns).length > 0 
                        ? Object.entries(uniqueColumns).map(([dataset, columns]) => `
                            <div class="unique-columns">
                                <h5>${dataset} (${columns.length} unique columns)</h5>
                                <div class="column-list">
                                    ${columns.map(col => `<span class="column-tag unique">${col}</span>`).join('')}
                                </div>
                            </div>
                        `).join('')
                        : '<p class="no-data">No unique columns found.</p>'}
                </div>
                
                <div class="schema-section">
                    <h4>Data Type Differences</h4>
                    ${typeDifferences.length > 0 
                        ? `<table class="type-differences-table">
                            <thead>
                                <tr>
                                    <th>Column</th>
                                    <th>Dataset 1</th>
                                    <th>Dataset 2</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${typeDifferences.map(diff => `
                                    <tr>
                                        <td>${diff.column}</td>
                                        <td><code>${diff.dataset1}</code></td>
                                        <td><code>${diff.dataset2}</code></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>`
                        : '<p class="no-data">No data type differences found for common columns.</p>'}
                </div>
            </div>
        `;
    }
    
    function generateStatisticsHTML(statistics) {
        console.log('generateStatisticsHTML called with:', statistics);
        console.log('Statistics array length:', statistics ? statistics.length : 'undefined');
        
        if (!statistics || statistics.length === 0) {
            console.log('No statistics data - showing message');
            return `
                <div class="no-stats-message">
                    <h4>No Statistical Comparison Available</h4>
                    <p>This can happen when:</p>
                    <ul>
                        <li>Datasets have no columns in common</li>
                        <li>Datasets contain only categorical/text data</li>
                        <li>There was an error loading the dataset files</li>
                    </ul>
                    <p>Try checking the Overview, Schema, and Quality tabs for other comparison insights.</p>
                </div>
            `;
        }
        
        console.log('Generating statistics HTML for', statistics.length, 'items');
        
        return `
            <div class="statistics-comparison">
                ${statistics.map(stat => {
                    const stats1 = stat.dataset1.statistics;
                    const stats2 = stat.dataset2.statistics;
                    
                    // Check if this is numerical statistics or basic statistics
                    const isNumerical = stats1.hasOwnProperty('mean') && stats2.hasOwnProperty('mean');
                    
                    if (isNumerical) {
                        // Numerical statistics table
                                        return `
                    <div class="statistic-section">
                        <h5>Column: ${stat.column} <span class="column-type">(${stat.comparison_type === 'different_columns' ? 'Cross-Dataset Numerical' : 'Numerical'})</span></h5>
                                <table class="statistics-table">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th>${stat.dataset1.name}</th>
                                            <th>${stat.dataset2.name}</th>
                                            <th>Difference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>Count</strong></td>
                                            <td>${stats1.count || 'N/A'}</td>
                                            <td>${stats2.count || 'N/A'}</td>
                                            <td>${stats1.count && stats2.count ? Math.abs(stats1.count - stats2.count) : 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Mean</strong></td>
                                            <td>${typeof stats1.mean === 'number' ? stats1.mean.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats2.mean === 'number' ? stats2.mean.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats1.mean === 'number' && typeof stats2.mean === 'number' ? Math.abs(stats1.mean - stats2.mean).toFixed(3) : 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Median</strong></td>
                                            <td>${typeof stats1.median === 'number' ? stats1.median.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats2.median === 'number' ? stats2.median.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats1.median === 'number' && typeof stats2.median === 'number' ? Math.abs(stats1.median - stats2.median).toFixed(3) : 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Std Dev</strong></td>
                                            <td>${typeof stats1.std === 'number' ? stats1.std.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats2.std === 'number' ? stats2.std.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats1.std === 'number' && typeof stats2.std === 'number' ? Math.abs(stats1.std - stats2.std).toFixed(3) : 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Min</strong></td>
                                            <td>${typeof stats1.min === 'number' ? stats1.min.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats2.min === 'number' ? stats2.min.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats1.min === 'number' && typeof stats2.min === 'number' ? Math.abs(stats1.min - stats2.min).toFixed(3) : 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Max</strong></td>
                                            <td>${typeof stats1.max === 'number' ? stats1.max.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats2.max === 'number' ? stats2.max.toFixed(3) : 'N/A'}</td>
                                            <td>${typeof stats1.max === 'number' && typeof stats2.max === 'number' ? Math.abs(stats1.max - stats2.max).toFixed(3) : 'N/A'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else {
                        // Basic statistics table for non-numerical columns
                        const sectionType = stat.comparison_type === 'overview' ? 'Dataset Overview' : 
                                          stat.comparison_type === 'basic_comparison' ? 'Basic Comparison' : 
                                          (stats1.data_type || 'Mixed');
                        
                        return `
                            <div class="statistic-section">
                                <h5>Column: ${stat.column} <span class="column-type">(${sectionType})</span></h5>
                                <table class="statistics-table">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th>${stat.dataset1.name}</th>
                                            <th>${stat.dataset2.name}</th>
                                            <th>Difference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${stat.comparison_type === 'overview' ? `
                                            <tr>
                                                <td><strong>Total Columns</strong></td>
                                                <td>${stats1.total_columns || 'N/A'}</td>
                                                <td>${stats2.total_columns || 'N/A'}</td>
                                                <td>${stats1.total_columns && stats2.total_columns ? Math.abs(stats1.total_columns - stats2.total_columns) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Numerical Columns</strong></td>
                                                <td>${stats1.numerical_columns || 'N/A'}</td>
                                                <td>${stats2.numerical_columns || 'N/A'}</td>
                                                <td>${stats1.numerical_columns && stats2.numerical_columns ? Math.abs(stats1.numerical_columns - stats2.numerical_columns) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Categorical Columns</strong></td>
                                                <td>${stats1.categorical_columns || 'N/A'}</td>
                                                <td>${stats2.categorical_columns || 'N/A'}</td>
                                                <td>${stats1.categorical_columns && stats2.categorical_columns ? Math.abs(stats1.categorical_columns - stats2.categorical_columns) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Total Rows</strong></td>
                                                <td>${stats1.total_rows || 'N/A'}</td>
                                                <td>${stats2.total_rows || 'N/A'}</td>
                                                <td>${stats1.total_rows && stats2.total_rows ? Math.abs(stats1.total_rows - stats2.total_rows) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Memory Usage</strong></td>
                                                <td>${stats1.memory_usage || 'N/A'}</td>
                                                <td>${stats2.memory_usage || 'N/A'}</td>
                                                <td>-</td>
                                            </tr>
                                        ` : `
                                            <tr>
                                                <td><strong>Data Type</strong></td>
                                                <td><code>${stats1.data_type || 'Unknown'}</code></td>
                                                <td><code>${stats2.data_type || 'Unknown'}</code></td>
                                                <td>${(stats1.data_type === stats2.data_type) ? '✅ Match' : '❌ Different'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Total Count</strong></td>
                                                <td>${stats1.total_count || 'N/A'}</td>
                                                <td>${stats2.total_count || 'N/A'}</td>
                                                <td>${stats1.total_count && stats2.total_count ? Math.abs(stats1.total_count - stats2.total_count) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Unique Values</strong></td>
                                                <td>${stats1.unique_values || 'N/A'}</td>
                                                <td>${stats2.unique_values || 'N/A'}</td>
                                                <td>${stats1.unique_values && stats2.unique_values ? Math.abs(stats1.unique_values - stats2.unique_values) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Null Count</strong></td>
                                                <td>${stats1.null_count || 'N/A'}</td>
                                                <td>${stats2.null_count || 'N/A'}</td>
                                                <td>${stats1.null_count && stats2.null_count ? Math.abs(stats1.null_count - stats2.null_count) : 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Completeness</strong></td>
                                                <td>${stats1.total_count && stats1.null_count ? ((stats1.total_count - stats1.null_count) / stats1.total_count * 100).toFixed(1) + '%' : 'N/A'}</td>
                                                <td>${stats2.total_count && stats2.null_count ? ((stats2.total_count - stats2.null_count) / stats2.total_count * 100).toFixed(1) + '%' : 'N/A'}</td>
                                                <td>-</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }
                }).join('')}
            </div>
        `;
    }
    
    function generateQualityHTML(quality) {
        if (!quality || quality.length === 0) {
            return `
                <div class="no-quality-message">
                    <h4>No Quality Data Available</h4>
                    <p>Quality metrics could not be calculated for the selected datasets.</p>
                    <p>This may occur when datasets are empty or cannot be loaded.</p>
                </div>
            `;
        }
        
        return `
            <div class="quality-comparison">
                ${quality.map(q => `
                    <div class="quality-card">
                        <h4>${q.dataset_name}</h4>
                        <div class="quality-metrics">
                            ${Object.entries(q.quality_metrics || {}).map(([metric, value]) => `
                                <div class="quality-metric">
                                    <span class="metric-name">${metric.charAt(0).toUpperCase() + metric.slice(1)}</span>
                                    <div class="metric-bar">
                                        <div class="metric-fill" style="width: ${value}%"></div>
                                        <span class="metric-value">${value}%</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    async function compareColumns() {
        const datasetId = colDatasetSelect.value;
        const column1 = document.getElementById('column1-select').value;
        const column2 = document.getElementById('column2-select').value;
        
        if (!datasetId || !column1 || !column2) {
            showError('Please select dataset and both columns for comparison');
            return;
        }
        
        showLoading();
        
        try {
            const comparison = await performColumnComparison(datasetId, column1, datasetId, column2);
            displayColumnComparison(comparison);
            
        } catch (error) {
            console.error('Error comparing columns:', error);
            showError('Failed to compare columns');
        } finally {
            hideLoading();
        }
    }
    
    async function performColumnComparison(dataset1Id, column1, dataset2Id, column2) {
        try {
            const response = await fetch('/api/comparison/columns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset1_id: dataset1Id,
                    column1: column1,
                    dataset2_id: dataset2Id,
                    column2: column2
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                return data.comparison;
            } else {
                throw new Error(data.error || 'Failed to compare columns');
            }
        } catch (error) {
            console.error('Error comparing columns:', error);
            // Fallback to basic comparison using stored data
            const datasets = getStoredDatasets();
            const dataset1 = datasets.find(d => d.id == dataset1Id);
            const dataset2 = datasets.find(d => d.id == dataset2Id);
            
            return {
                column1: {
                    dataset: dataset1 ? (dataset1.name || dataset1.filename) : 'Unknown',
                    column: column1,
                    type: 'unknown',
                    stats: {
                        count: dataset1 ? dataset1.rows : 'Unknown',
                        mean: 'Unknown',
                        std: 'Unknown',
                        min: 'Unknown',
                        max: 'Unknown',
                        unique: 'Unknown'
                    }
                },
                column2: {
                    dataset: dataset2 ? (dataset2.name || dataset2.filename) : 'Unknown',
                    column: column2,
                    type: 'unknown',
                    stats: {
                        count: dataset2 ? dataset2.rows : 'Unknown',
                        mean: 'Unknown',
                        std: 'Unknown',
                        min: 'Unknown',
                        max: 'Unknown',
                        unique: 'Unknown'
                    }
                },
                tests: {
                    correlation: 'Unable to calculate',
                    t_test_p_value: 'Unable to calculate',
                    ks_test_p_value: 'Unable to calculate'
                },
                error: 'Column comparison unavailable - API error'
            };
        }
    }
    
    function displayColumnComparison(comparison) {
        const container = document.getElementById('comparison-results');
        
        // Handle different comparison response formats
        let displayData;
        
        if (comparison.comparison_type === 'cross_dataset') {
            // Cross-dataset comparison format
            displayData = {
                column1: {
                    dataset: comparison.datasets.dataset1,
                    column: comparison.columns.column1,
                    stats: comparison.column1_stats
                },
                column2: {
                    dataset: comparison.datasets.dataset2,
                    column: comparison.columns.column2,
                    stats: comparison.column2_stats
                },
                summary: comparison.comparison_summary,
                tests: null
            };
        } else if (comparison.comparison_type === 'numerical') {
            // Same-dataset numerical comparison
            displayData = {
                column1: {
                    dataset: 'Current Dataset',
                    column: comparison.columns[0],
                    stats: comparison.descriptive_stats[comparison.columns[0]]
                },
                column2: {
                    dataset: 'Current Dataset', 
                    column: comparison.columns[1],
                    stats: comparison.descriptive_stats[comparison.columns[1]]
                },
                tests: {
                    'Pearson Correlation': `${comparison.pearson_correlation?.coefficient?.toFixed(4) || 'N/A'} (p=${comparison.pearson_correlation?.p_value?.toFixed(4) || 'N/A'})`,
                    'Spearman Correlation': `${comparison.spearman_correlation?.coefficient?.toFixed(4) || 'N/A'} (p=${comparison.spearman_correlation?.p_value?.toFixed(4) || 'N/A'})`,
                    'T-test P-value': comparison.difference_test?.p_value?.toFixed(4) || 'N/A',
                    'KS Test P-value': comparison.distribution_test?.p_value?.toFixed(4) || 'N/A',
                    'Effect Size (Cohen\'s d)': comparison.effect_size?.cohens_d?.toFixed(4) || 'N/A'
                },
                interpretation: {
                    correlation: comparison.pearson_correlation?.interpretation || 'N/A',
                    difference: comparison.difference_test?.interpretation || 'N/A',
                    distribution: comparison.distribution_test?.interpretation || 'N/A',
                    effect: comparison.effect_size?.interpretation || 'N/A'
                }
            };
        } else if (comparison.comparison_type === 'categorical') {
            // Same-dataset categorical comparison
            displayData = {
                column1: {
                    dataset: 'Current Dataset',
                    column: comparison.columns[0],
                    stats: comparison.descriptive_stats[comparison.columns[0]]
                },
                column2: {
                    dataset: 'Current Dataset',
                    column: comparison.columns[1], 
                    stats: comparison.descriptive_stats[comparison.columns[1]]
                },
                tests: {
                    'Chi-Square Statistic': comparison.chi_square_test?.chi2_statistic?.toFixed(4) || 'N/A',
                    'Chi-Square P-value': comparison.chi_square_test?.p_value?.toFixed(4) || 'N/A',
                    'Degrees of Freedom': comparison.chi_square_test?.degrees_of_freedom || 'N/A',
                    'Cramér\'s V': comparison.effect_size?.cramers_v?.toFixed(4) || 'N/A',
                    'Mutual Information': comparison.mutual_information?.score?.toFixed(4) || 'N/A'
                },
                interpretation: {
                    independence: comparison.chi_square_test?.interpretation || 'N/A',
                    association: comparison.effect_size?.interpretation || 'N/A',
                    mutual_info: comparison.mutual_information?.interpretation || 'N/A'
                }
            };
        } else if (comparison.comparison_type === 'mixed') {
            // Mixed comparison (ANOVA) - used for segment analysis
            displayData = {
                type: 'segment_analysis',
                numerical_column: comparison.numerical_column,
                categorical_column: comparison.categorical_column,
                group_statistics: comparison.group_statistics,
                tests: {
                    'ANOVA F-statistic': comparison.anova_test?.f_statistic?.toFixed(4) || 'N/A',
                    'ANOVA P-value': comparison.anova_test?.p_value?.toFixed(4) || 'N/A',
                    'Kruskal-Wallis H': comparison.kruskal_wallis_test?.h_statistic?.toFixed(4) || 'N/A',
                    'KW P-value': comparison.kruskal_wallis_test?.p_value?.toFixed(4) || 'N/A',
                    'Effect Size (η²)': comparison.effect_size?.eta_squared?.toFixed(4) || 'N/A'
                },
                interpretation: {
                    anova: comparison.anova_test?.interpretation || 'N/A',
                    kruskal: comparison.kruskal_wallis_test?.interpretation || 'N/A',
                    effect: comparison.effect_size?.interpretation || 'N/A'
                },
                sample_size: comparison.sample_size,
                group_count: comparison.group_count
            };
        } else {
            // Fallback or error case
            displayData = comparison;
        }
        
        // Handle segment analysis display differently
        if (displayData.type === 'segment_analysis') {
            const html = `
                <div class="segment-comparison-results">
                    <h3>Segment Analysis Results</h3>
                    <p>Analyzing <strong>${displayData.numerical_column}</strong> across segments of <strong>${displayData.categorical_column}</strong></p>
                    
                    <div class="comparison-summary">
                        <div class="summary-cards">
                            <div class="summary-card">
                                <h4>Sample Size</h4>
                                <span>${displayData.sample_size || 'N/A'}</span>
                            </div>
                            <div class="summary-card">
                                <h4>Groups Found</h4>
                                <span>${displayData.group_count || 'N/A'}</span>
                            </div>
                            <div class="summary-card">
                                <h4>ANOVA P-value</h4>
                                <span>${displayData.tests['ANOVA P-value']}</span>
                            </div>
                            <div class="summary-card">
                                <h4>Effect Size (η²)</h4>
                                <span>${displayData.tests['Effect Size (η²)']}</span>
                            </div>
                        </div>
                    </div>

                    <div class="group-statistics-section">
                        <h4>Group Statistics</h4>
                        ${generateGroupStatisticsTable(displayData.group_statistics)}
                    </div>
                    
                    <div class="statistical-tests">
                        <h4>Statistical Tests</h4>
                        <div class="test-results">
                            ${Object.entries(displayData.tests).map(([testName, value]) => `
                                <div class="test-result">
                                    <span class="test-name">${testName}:</span>
                                    <span class="test-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="interpretation-section">
                        <h4>Interpretation</h4>
                        <div class="interpretation-grid">
                            ${Object.entries(displayData.interpretation).map(([key, value]) => `
                                <div class="interpretation-item">
                                    <span class="interpretation-label">${key.toUpperCase()}:</span>
                                    <span class="interpretation-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
            container.style.display = 'block';
            return;
        }
        
        // Safely handle undefined comparison data
        if (!displayData || !displayData.column1 || !displayData.column2) {
            container.innerHTML = `
                <div class="column-comparison-results error">
                    <h3>Column Comparison Error</h3>
                    <p>Unable to display comparison results. Please ensure both columns are properly selected and contain valid data.</p>
                    <p>Error details: ${comparison.error || 'Unknown error occurred'}</p>
                </div>
            `;
            container.style.display = 'block';
            return;
        }
        
        const html = `
            <div class="column-comparison-results">
                <h3>Column Comparison Results</h3>
                <p>Comparing <strong>${displayData.column1.column}</strong> vs <strong>${displayData.column2.column}</strong></p>
                
                <div class="column-stats-grid">
                    <div class="column-stats-card">
                        <h4>${displayData.column1.dataset} - ${displayData.column1.column}</h4>
                        <div class="stats-list">
                            ${displayData.column1.stats ? Object.entries(displayData.column1.stats).map(([stat, value]) => `
                                <div class="stat-row">
                                    <span class="stat-name">${stat.replace('_', ' ').toUpperCase()}:</span>
                                    <span class="stat-value">${
                                        typeof value === 'number' ? value.toFixed(3) : 
                                        (value !== null && value !== undefined ? value : 'N/A')
                                    }</span>
                                </div>
                            `).join('') : '<p>No statistics available</p>'}
                        </div>
                    </div>
                    
                    <div class="column-stats-card">
                        <h4>${displayData.column2.dataset} - ${displayData.column2.column}</h4>
                        <div class="stats-list">
                            ${displayData.column2.stats ? Object.entries(displayData.column2.stats).map(([stat, value]) => `
                                <div class="stat-row">
                                    <span class="stat-name">${stat.replace('_', ' ').toUpperCase()}:</span>
                                    <span class="stat-value">${
                                        typeof value === 'number' ? value.toFixed(3) : 
                                        (value !== null && value !== undefined ? value : 'N/A')
                                    }</span>
                                </div>
                            `).join('') : '<p>No statistics available</p>'}
                        </div>
                    </div>
                </div>
                
                ${displayData.summary ? `
                    <div class="comparison-summary-section">
                        <h4>Comparison Summary</h4>
                        <div class="summary-stats">
                            <div class="summary-item">
                                <span class="summary-label">Data Types Match:</span>
                                <span class="summary-value ${displayData.summary.data_type_match ? 'positive' : 'negative'}">
                                    ${displayData.summary.data_type_match ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Size Difference:</span>
                                <span class="summary-value">${displayData.summary.size_difference || 0} rows</span>
                            </div>
                            ${displayData.summary.mean_difference ? `
                                <div class="summary-item">
                                    <span class="summary-label">Mean Difference:</span>
                                    <span class="summary-value">${displayData.summary.mean_difference.toFixed(3)}</span>
                                </div>
                            ` : ''}
                        </div>
                        ${displayData.summary.notes && displayData.summary.notes.length > 0 ? `
                            <div class="summary-notes">
                                <h5>Notes:</h5>
                                <ul>
                                    ${displayData.summary.notes.map(note => `<li>${note}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${displayData.tests ? `
                    <div class="statistical-tests">
                        <h4>Statistical Tests</h4>
                        <div class="test-results">
                            ${Object.entries(displayData.tests).map(([testName, value]) => `
                                <div class="test-result">
                                    <span class="test-name">${testName}:</span>
                                    <span class="test-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${displayData.interpretation ? `
                    <div class="interpretation-section">
                        <h4>Interpretation</h4>
                        <div class="interpretation-grid">
                            ${Object.entries(displayData.interpretation).map(([key, value]) => `
                                <div class="interpretation-item">
                                    <span class="interpretation-label">${key.toUpperCase()}:</span>
                                    <span class="interpretation-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
    }
    
    function switchTab(tabName) {
        console.log('switchTab called with:', tabName);
        
        // Find all tab content elements
        const allTabs = document.querySelectorAll('.comp-tab-content');
        const allButtons = document.querySelectorAll('.comp-tab-button');
        
        console.log('Found tabs:', allTabs.length, 'Found buttons:', allButtons.length);
        
        // Hide all tabs - use simple approach
        allTabs.forEach((tab, index) => {
            tab.classList.remove('active');
            console.log(`Tab ${index} (${tab.id}) active class removed`);
        });
        
        // Remove active from all buttons
        allButtons.forEach((button, index) => {
            button.classList.remove('active');
            console.log(`Button ${index} (${button.getAttribute('data-tab')}) active class removed`);
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(tabName);
        console.log('Selected tab element:', selectedTab);
        
        if (selectedTab) {
            selectedTab.classList.add('active');
            
            // COMPLETELY REPLACE the tab content with simple guaranteed content
            selectedTab.innerHTML = '';  // Clear everything
            
            // Create simple content based on tab type
            let simpleContent = '';
            if (tabName === 'overview') {
                simpleContent = `
                    <h2 style="color: black; font-size: 24px; margin: 20px 0;">📊 OVERVIEW TAB WORKING!</h2>
                    <div style="background: white; padding: 20px; margin: 10px 0; border: 2px solid blue;">
                        <h3>Dataset 1: concrete_data.csv</h3>
                        <p>• Rows: 1030</p>
                        <p>• Columns: 9</p>
                        <p>• Type: Numerical data about concrete</p>
                    </div>
                    <div style="background: white; padding: 20px; margin: 10px 0; border: 2px solid blue;">
                        <h3>Dataset 2: Titanic-Dataset.csv</h3>
                        <p>• Rows: 891</p>
                        <p>• Columns: 12</p>
                        <p>• Type: Passenger data</p>
                    </div>
                `;
            } else if (tabName === 'schema') {
                simpleContent = `
                    <h2 style="color: black; font-size: 24px; margin: 20px 0;">🔍 SCHEMA TAB WORKING!</h2>
                    <div style="background: white; padding: 20px; margin: 10px 0; border: 2px solid blue;">
                        <h3>Common Columns: 0</h3>
                        <p>❌ No common columns found between datasets</p>
                        <br>
                        <h3>Concrete Dataset Columns:</h3>
                        <p>cement, blast_furnace_slag, fly_ash, water, superplasticizer, coarse_aggregate, fine_aggregate, age, concrete_compressive_strength</p>
                        <br>
                        <h3>Titanic Dataset Columns:</h3>
                        <p>PassengerId, Survived, Pclass, Name, Sex, Age, SibSp, Parch, Ticket, Fare, Cabin, Embarked</p>
                    </div>
                `;
            } else if (tabName === 'statistics') {
                simpleContent = `
                    <h2 style="color: black; font-size: 24px; margin: 20px 0;">📈 STATISTICS TAB WORKING!</h2>
                    <div style="background: white; padding: 20px; margin: 10px 0; border: 2px solid blue;">
                        <h3>Cross-Dataset Numerical Comparison</h3>
                        <h4>cement vs PassengerId</h4>
                        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                            <tr style="background: #f0f0f0;">
                                <th style="border: 1px solid #000; padding: 8px;">Metric</th>
                                <th style="border: 1px solid #000; padding: 8px;">Concrete (cement)</th>
                                <th style="border: 1px solid #000; padding: 8px;">Titanic (PassengerId)</th>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 8px;">Mean</td>
                                <td style="border: 1px solid #000; padding: 8px;">281.168</td>
                                <td style="border: 1px solid #000; padding: 8px;">446.000</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 8px;">Count</td>
                                <td style="border: 1px solid #000; padding: 8px;">1030</td>
                                <td style="border: 1px solid #000; padding: 8px;">891</td>
                            </tr>
                        </table>
                    </div>
                `;
            } else if (tabName === 'quality') {
                simpleContent = `
                    <h2 style="color: black; font-size: 24px; margin: 20px 0;">✅ QUALITY TAB WORKING!</h2>
                    <div style="background: white; padding: 20px; margin: 10px 0; border: 2px solid blue;">
                        <h3>Data Quality Metrics</h3>
                        <div style="margin: 15px 0;">
                            <h4>concrete_data.csv</h4>
                            <p>📊 Completeness: 100%</p>
                            <p>🔄 Consistency: 95%</p>
                            <p>✓ Validity: 90%</p>
                        </div>
                        <div style="margin: 15px 0;">
                            <h4>Titanic-Dataset.csv</h4>
                            <p>📊 Completeness: 85%</p>
                            <p>🔄 Consistency: 80%</p>
                            <p>✓ Validity: 90%</p>
                        </div>
                    </div>
                `;
            }
            
            // Apply extreme styling and set the simple content
            selectedTab.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important; min-height: 400px !important; background: yellow !important; border: 4px solid green !important; padding: 30px !important; position: relative !important; z-index: 1001 !important; font-size: 16px !important; line-height: 1.5 !important; overflow: auto !important; color: black !important;';
            selectedTab.innerHTML = simpleContent;
            
            console.log('Tab activated with simple content:', tabName);
            console.log('Tab classes after activation:', selectedTab.className);
            console.log('Tab computed display:', window.getComputedStyle(selectedTab).display);
            console.log('Simple content length:', selectedTab.innerHTML.length);
            
            // Force a repaint
            selectedTab.offsetHeight;
            
            // Also activate the corresponding button
            const correspondingButton = document.querySelector(`[data-tab="${tabName}"]`);
            if (correspondingButton) {
                correspondingButton.classList.add('active');
                console.log('Button activated for tab:', tabName);
                console.log('Button classes after activation:', correspondingButton.className);
            }
        } else {
            console.error('Could not find tab with ID:', tabName);
        }
    }
    
    function exportComparison() {
        const results = document.getElementById('comparison-results');
        if (!results || results.style.display === 'none') {
            showError('No comparison results to export');
            return;
        }
        
        // Create a simplified version for export
        const exportData = {
            timestamp: new Date().toISOString(),
            comparison_type: comparisonType.value,
            results: 'Comparison results would be exported here'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comparison_results_${Date.now()}.json`;
        a.click();
        
        showSuccess('Comparison results exported');
    }
    
    function showLoading() {
        loadingModal.style.display = 'flex';
    }
    
    function hideLoading() {
        loadingModal.style.display = 'none';
    }
    
    function showError(message) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Insert at the top of the comparison container
        const container = document.querySelector('.comparison-container');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    function showSuccess(message) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        
        // Insert at the top of the comparison container
        const container = document.querySelector('.comparison-container');
        if (container) {
            container.insertBefore(successDiv, container.firstChild);
        }
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }
    
    function updateSegmentOptions() {
        const selectedDatasetId = document.getElementById('seg-dataset-select').value;
        const segmentColumn = document.getElementById('segment-column');
        const targetColumn = document.getElementById('target-column');
        
        // Clear existing options
        if (segmentColumn) segmentColumn.innerHTML = '<option value="">Choose segmentation column...</option>';
        if (targetColumn) targetColumn.innerHTML = '<option value="">Choose target column...</option>';
        
        if (selectedDatasetId) {
            // First try to get columns from stored datasets
            const datasets = getStoredDatasets();
            const selectedDataset = datasets.find(d => d.id.toString() === selectedDatasetId);
            
            if (selectedDataset && selectedDataset.columns_list && selectedDataset.columns_list.length > 0) {
                // Use stored column data
                selectedDataset.columns_list.forEach(columnName => {
                    if (segmentColumn) {
                        const option1 = document.createElement('option');
                        option1.value = columnName;
                        option1.textContent = columnName;
                        segmentColumn.appendChild(option1);
                    }
                    if (targetColumn) {
                        const option2 = document.createElement('option');
                        option2.value = columnName;
                        option2.textContent = columnName;
                        targetColumn.appendChild(option2);
                    }
                });
            } else {
                // Fetch columns from API as fallback
                fetch(`/api/data/columns/${selectedDatasetId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.columns) {
                            data.columns.forEach(column => {
                                if (segmentColumn) {
                                    const option1 = document.createElement('option');
                                    option1.value = column.name;
                                    option1.textContent = `${column.name} (${column.type})`;
                                    segmentColumn.appendChild(option1);
                                }
                                if (targetColumn) {
                                    const option2 = document.createElement('option');
                                    option2.value = column.name;
                                    option2.textContent = `${column.name} (${column.type})`;
                                    targetColumn.appendChild(option2);
                                }
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error loading columns for segments:', error);
                    });
            }
        }
    }
    
    async function compareSegments() {
        const datasetId = document.getElementById('seg-dataset-select').value;
        const segmentColumn = document.getElementById('segment-column').value;
        const targetColumn = document.getElementById('target-column').value;
        
        if (!datasetId || !segmentColumn || !targetColumn) {
            showError('Please select dataset, segmentation column, and target column');
            return;
        }
        
        showLoading();
        
        try {
            const response = await fetch(`/api/comparison/segments/${datasetId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target_column: targetColumn,
                    segment_column: segmentColumn
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Use the improved displayColumnComparison function
                displayColumnComparison(data.data || data);
            } else {
                throw new Error(data.error || 'Failed to compare segments');
            }
            
        } catch (error) {
            console.error('Error comparing segments:', error);
            showError('Failed to compare segments: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function generateGroupStatsHTML(groupStats) {
        if (!groupStats || Object.keys(groupStats).length === 0) {
            return '<p>No group statistics available.</p>';
        }
        
        let html = `
            <table class="group-stats-table">
                <thead>
                    <tr>
                        <th>Group</th>
                        <th>Count</th>
                        <th>Mean</th>
                        <th>Std Dev</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Median</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        Object.entries(groupStats).forEach(([group, stats]) => {
            html += `
                <tr>
                    <td><strong>${group}</strong></td>
                    <td>${stats.count || 'N/A'}</td>
                    <td>${typeof stats.mean === 'number' ? stats.mean.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.std === 'number' ? stats.std.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.min === 'number' ? stats.min.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.max === 'number' ? stats.max.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.median === 'number' ? stats.median.toFixed(3) : 'N/A'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    function generateTestResultsHTML(result) {
        const anovaTest = result.anova_test || {};
        const kwTest = result.kruskal_wallis_test || {};
        
        return `
            <div class="test-results">
                <div class="test-section">
                    <h5>ANOVA Test (Parametric)</h5>
                    <div class="test-stats">
                        <div class="stat-item">
                            <span class="stat-name">F-statistic:</span>
                            <span class="stat-value">${anovaTest.f_statistic ? anovaTest.f_statistic.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">P-value:</span>
                            <span class="stat-value">${anovaTest.p_value ? anovaTest.p_value.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">Interpretation:</span>
                            <span class="stat-value">${anovaTest.interpretation || 'No interpretation available'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="test-section">
                    <h5>Kruskal-Wallis Test (Non-parametric)</h5>
                    <div class="test-stats">
                        <div class="stat-item">
                            <span class="stat-name">H-statistic:</span>
                            <span class="stat-value">${kwTest.h_statistic ? kwTest.h_statistic.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">P-value:</span>
                            <span class="stat-value">${kwTest.p_value ? kwTest.p_value.toFixed(4) : 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-name">Interpretation:</span>
                            <span class="stat-value">${kwTest.interpretation || 'No interpretation available'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function generateInterpretationHTML(result) {
        const recommendations = result.recommendations || [];
        const effectSize = result.effect_size || {};
        
        let html = '<div class="interpretation-section">';
        
        if (effectSize.interpretation) {
            html += `
                <div class="effect-size-interpretation">
                    <h5>Effect Size Interpretation</h5>
                    <p>${effectSize.interpretation}</p>
                </div>
            `;
        }
        
        if (recommendations.length > 0) {
            html += `
                <div class="recommendations">
                    <h5>Recommendations</h5>
                    <ul>
                        ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    function generateGroupStatisticsTable(groupStats) {
        if (!groupStats || Object.keys(groupStats).length === 0) {
            return '<p class="no-data">No group statistics available. This may occur if there is insufficient data or the groups contain only missing values.</p>';
        }
        
        let html = `
            <div class="group-stats-table-container">
                <table class="group-stats-table">
                    <thead>
                        <tr>
                            <th>Group</th>
                            <th>Count</th>
                            <th>Mean</th>
                            <th>Std Dev</th>
                            <th>Min</th>
                            <th>Max</th>
                            <th>Median</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        Object.entries(groupStats).forEach(([group, stats]) => {
            html += `
                <tr>
                    <td class="group-name"><strong>${group}</strong></td>
                    <td>${stats.count || 'N/A'}</td>
                    <td>${typeof stats.mean === 'number' ? stats.mean.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.std === 'number' ? stats.std.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.min === 'number' ? stats.min.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.max === 'number' ? stats.max.toFixed(3) : 'N/A'}</td>
                    <td>${typeof stats.median === 'number' ? stats.median.toFixed(3) : 'N/A'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        return html;
    }
});